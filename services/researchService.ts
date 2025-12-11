import { type ResearchJob } from '../types';
import { type Settings } from './settings';
import * as localLlmService from './localLlmService';
import * as cloudLlmService from './cloudLlmService';
import * as webAccessService from './webAccessService';
import * as systemService from './systemService';

type LlmCompletionFn = (prompt: string, useCloud?: boolean) => Promise<string>;

const getLlmCompletion = (settings: Settings): LlmCompletionFn => {
    return async (prompt: string, useCloud: boolean = false): Promise<string> => {
        const apiKey = (settings.developerMode && settings.dev_geminiApiKey) ? settings.dev_geminiApiKey : (process.env.API_KEY || '');
        
        if (useCloud) {
            if (!apiKey) throw new Error("Cloud API Key is required for this step but not configured.");
             return cloudLlmService.getCompletion(prompt, settings, apiKey);
        }
        
        if (settings.aiProvider === 'localLlm') {
            return localLlmService.getCompletion(prompt, {
                ...settings,
                url: settings.localLlmUrl,
                model: settings.localLlmModelName,
                localLlmPromptFormat: settings.localLlmPromptFormat,
                systemInstruction: "You are a helpful research assistant.",
                messages: [], // getCompletion will handle wrapping
            });
        } else {
             return cloudLlmService.getCompletion(prompt, settings, apiKey);
        }
    };
};


async function generateSearchQueries(topic: string, llm: LlmCompletionFn): Promise<string[]> {
    const prompt = `You are an expert researcher. Based on the following topic, generate 5 diverse and effective web search queries to gather comprehensive information. Output ONLY the queries, one per line. Do not include numbers, bullet points, or any other text.\n\nTopic: "${topic}"`;
    const result = await llm(prompt);
    return result.split('\n').map(q => q.trim()).filter(Boolean);
}

async function executeSearches(queries: string[], settings: Settings): Promise<string> {
    let allResults = `Raw search data for topic: "${queries.join(', ')}"\n\n`;
    for (const query of queries) {
        try {
            const searchResult = await webAccessService.search(query, settings);
            allResults += `--- RESULTS FOR QUERY: "${query}" ---\n${searchResult}\n\n`;
        } catch (error) {
            allResults += `--- FAILED TO EXECUTE QUERY: "${query}" ---\nError: ${error instanceof Error ? error.message : String(error)}\n\n`;
        }
    }
    return allResults;
}

async function summarizeResearch(researchData: string, topic: string, llm: LlmCompletionFn): Promise<string> {
    const prompt = `Based on the following raw search data, write a comprehensive summary about the topic: "${topic}". Structure the summary with clear headings and paragraphs. Synthesize the information, do not just list the search results.\n\n--- RAW DATA ---\n${researchData}`;
    return llm(prompt);
}

async function factCheckSummary(summary: string, topic: string, settings: Settings, llm: LlmCompletionFn): Promise<string> {
    const claimsPrompt = `Extract the top 5 most important and verifiable factual claims from the following summary on "${topic}". Output ONLY the claims, one per line. Do not include numbers or bullet points.\n\n--- SUMMARY ---\n${summary}`;
    const claims = (await llm(claimsPrompt, true)).split('\n').map(c => c.trim()).filter(Boolean);

    let report = "--- FACT-CHECKING REPORT ---\n\n";
    for (const claim of claims) {
        const searchResult = await webAccessService.search(`fact check: ${claim}`, settings);
        const verificationPrompt = `Based on the following search results, verify the claim: "${claim}". State whether the claim is "Confirmed," "Plausible," "Unverified," or "Inaccurate," and provide a brief explanation and the source URL.\n\n--- SEARCH RESULTS ---\n${searchResult}`;
        const verification = await llm(verificationPrompt, true);
        report += `Claim: ${claim}\nVerification:\n${verification}\n\n`;
    }
    return report;
}

export async function runNextResearchStep(job: ResearchJob, settings: Settings): Promise<ResearchJob> {
    const llm = getLlmCompletion(settings);
    const lastStep = job.completedSteps[job.completedSteps.length - 1] || null;

    try {
        if (!lastStep) {
            await systemService.appendToResearchFile(job.filePath, `Agent: Researcher\nTask: Generating search queries...\n\n`, settings.proxyUrl);
            const queries = await generateSearchQueries(job.topic, llm);
            await systemService.appendToResearchFile(job.filePath, `Generated Queries:\n- ${queries.join('\n- ')}`, settings.proxyUrl);
            return { ...job, currentAgent: 'Researcher', statusMessage: 'Executing web searches...', completedSteps: ['generated-queries'] };
        }
        
        if (lastStep === 'generated-queries') {
            await systemService.appendToResearchFile(job.filePath, `Agent: Researcher\nTask: Executing web searches and gathering data...\n\n`, settings.proxyUrl);
            const researchFileContent = await systemService.readResearchFile(job.filePath, settings.proxyUrl);
            const queries = researchFileContent.content.match(/Generated Queries:\n- (.*)/s)?.[1].split('\n- ').map(q => q.trim()).filter(Boolean) || [];
            const searchResults = await executeSearches(queries, settings);
            await systemService.appendToResearchFile(job.filePath, searchResults, settings.proxyUrl);
            return { ...job, currentAgent: 'Summarizer', statusMessage: 'Summarizing research data...', completedSteps: [...job.completedSteps, 'executed-searches'] };
        }

        if (lastStep === 'executed-searches') {
            await systemService.appendToResearchFile(job.filePath, `Agent: Summarizer\nTask: Reading and summarizing all collected data...\n\n`, settings.proxyUrl);
            const researchFileContent = await systemService.readResearchFile(job.filePath, settings.proxyUrl);
            const summary = await summarizeResearch(researchFileContent.content, job.topic, llm);
            await systemService.appendToResearchFile(job.filePath, `--- COMPREHENSIVE SUMMARY ---\n\n${summary}`, settings.proxyUrl);
            return { ...job, status: 'confirm_factcheck', currentAgent: 'FactChecker', statusMessage: 'Awaiting user confirmation for fact-checking.', completedSteps: [...job.completedSteps, 'summarized'] };
        }

        if (lastStep === 'factcheck-confirmed') {
             await systemService.appendToResearchFile(job.filePath, `Agent: FactChecker\nTask: Verifying claims using cloud provider...\n\n`, settings.proxyUrl);
             const researchFileContent = await systemService.readResearchFile(job.filePath, settings.proxyUrl);
             const summary = researchFileContent.content.match(/--- COMPREHENSIVE SUMMARY ---\n\n([\s\S]*)/)?.[1] || '';
             const factCheckReport = await factCheckSummary(summary, job.topic, settings, llm);
             await systemService.appendToResearchFile(job.filePath, factCheckReport, settings.proxyUrl);
             return { ...job, status: 'complete', currentAgent: null, statusMessage: 'Research complete! Report saved to your Desktop.', completedSteps: [...job.completedSteps, 'fact-checked'] };
        }

    } catch (error: any) {
        await systemService.appendToResearchFile(job.filePath, `--- AGENT ERROR ---\nAgent: ${job.currentAgent}\nError: ${error.message}\n`, settings.proxyUrl);
        throw error; // Re-throw to be caught by the orchestrator
    }

    // Default return if no case matches (should not happen in a valid flow)
    return { ...job, status: 'complete', statusMessage: 'Research process finished unexpectedly.' };
}