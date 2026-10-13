/**
 * Apollo Client configuration for the AegisAI GraphQL endpoint.
 * JWT token is injected into every request via setContext.
 */
import { ApolloClient, InMemoryCache } from '@apollo/client/core';
import { createHttpLink } from '@apollo/client/link/http';
import { setContext } from '@apollo/client/link/context';
import { from } from '@apollo/client/link';

const apiBase = (import.meta.env.VITE_API_BASE_URL || '/v1').replace(/\/$/, '');

const httpLink = createHttpLink({
  uri: `${apiBase}/graphql`,
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('aegisai_token');
  return {
    headers: {
      ...headers,
      Authorization: token ? `Bearer ${token}` : '',
    },
  };
});

export const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
    query: { fetchPolicy: 'network-only' },
  },
});
