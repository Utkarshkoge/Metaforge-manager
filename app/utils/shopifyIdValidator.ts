export function validateShopifyId(gid: string | null | undefined, expectedType?: string): { isValid: boolean, error?: string } {
    if (!gid || typeof gid !== 'string') {
        return { isValid: false, error: "Invalid Shopify ID format. Expected a valid string." };
    }

    const trimmedGid = gid.trim();
    
    // Check general GID format: gid://shopify/<ResourceType>/<NumericId>
    const match = trimmedGid.match(/^gid:\/\/shopify\/([a-zA-Z]+)\/\d+$/);
    if (!match) {
        return { 
            isValid: false, 
            error: `Invalid Shopify ID format.\nExpected: gid://shopify/${expectedType || 'ResourceType'}/123456789\nReceived: ${trimmedGid}`
        };
    }
    
    // Check expected resource type if provided
    const gidType = match[1];
    if (expectedType) {
        let normalizedExpected = expectedType.toLowerCase();
        // Handle special case where 'blogPost' maps to 'Article'
        if (normalizedExpected === 'blogpost') normalizedExpected = 'article';
        
        if (gidType.toLowerCase() !== normalizedExpected) {
            return { 
                isValid: false, 
                error: `Resource type mismatch.\nThe selected resource is ${expectedType}.\nThe provided Shopify ID belongs to ${gidType}.\nPlease upload the correct Shopify IDs.` 
            };
        }
    }
    
    return { isValid: true };
}
