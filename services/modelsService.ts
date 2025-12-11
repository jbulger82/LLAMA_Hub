// services/modelsService.ts
import type { ApiModelListResponse } from '../types';
import { getBaseUrl, parseHeaders } from './utils';

export class ModelsService {
	static async list(config: { url: string, customHeaders?: string }): Promise<ApiModelListResponse> {
		const headers = {
			'Content-Type': 'application/json',
			...parseHeaders(config.customHeaders),
		};
		const baseUrl = getBaseUrl(config.url);
		const response = await fetch(`${baseUrl}/v1/models`, {
			headers
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch model list (status ${response.status})`);
		}

		return response.json() as Promise<ApiModelListResponse>;
	}
}
