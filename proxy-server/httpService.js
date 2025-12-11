import fetch from 'node-fetch'; // If Node 18+ native fetch is available, remove this import.

const makeRequest = async (url, options = {}) => {
    try {
        const response = await fetch(url, options);
        const contentType = response.headers.get('content-type');
        
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        return {
            ok: response.ok,
            status: response.status,
            data
        };
    } catch (error) {
        console.error('HTTP Service Error:', error);
        return {
            ok: false,
            error: error.message
        };
    }
};

export { makeRequest };
export default { makeRequest };
