export const typeDefs = `#graphql
  type User {
    id: ID!
    email: String!
    organizationId: String!
    role: String!
    status: String!
  }

  type AiRequest {
    id: ID!
    organizationId: String!
    requesterId: String!
    traceId: String!
    status: String!
    model: String
    provider: String
    createdAt: String!
    updatedAt: String!
  }

  type Policy {
    id: ID!
    organizationId: String!
    name: String!
    description: String
    action: String!
    createdAt: String!
    updatedAt: String!
  }

  type Approval {
    id: ID!
    aiRequestId: String!
    organizationId: String!
    status: String!
    createdAt: String!
    updatedAt: String!
  }

  type Query {
    me: User
    aiRequests(limit: Int, cursor: String): AiRequestConnection!
    policies: [Policy!]!
    approvals: [Approval!]!
  }

  type AiRequestConnection {
    items: [AiRequest!]!
    nextCursor: String
  }
`;
