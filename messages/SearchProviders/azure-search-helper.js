

// This helper transforms each of the AzureSearch result items using the mapping function provided (itemMap) 
function defaultResultsMapper(itemMap) {
    return function (providerResults) {
        return {
            results: providerResults.results.map(itemMap),
            facets: providerResults.facets
        };
    };
}

// Exports
module.exports = {
    defaultResultsMapper: defaultResultsMapper
};