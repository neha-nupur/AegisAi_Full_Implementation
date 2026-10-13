import type { AuthenticatedPrincipal } from "@aegisai/identity-service";
import type { AiRequestsService } from "@aegisai/gateway-service";
import type { ApprovalsService, PoliciesService } from "@aegisai/policy-service";

export interface GraphQLContext {
  user: AuthenticatedPrincipal;
  aiRequestsService: AiRequestsService;
  approvalsService: ApprovalsService;
  policiesService: PoliciesService;
}

export const resolvers = {
  Query: {
    me: (_parent: any, _args: any, context: GraphQLContext) => {
      return {
        id: context.user.userId,
        email: "user@example.com", // AuthenticatedPrincipal doesn't have email
        organizationId: context.user.organizationId,
        role: context.user.role,
        status: "ACTIVE"
      };
    },
    aiRequests: async (_parent: any, args: { limit?: number; cursor?: string }, context: GraphQLContext) => {
      const limit = args.limit || 50;
      return context.aiRequestsService.list(context.user, limit, args.cursor);
    },
    policies: async (_parent: any, _args: any, context: GraphQLContext) => {
      return context.policiesService.list(context.user);
    },
    approvals: async (_parent: any, _args: any, context: GraphQLContext) => {
      return context.approvalsService.list(context.user);
    },
  },
};
