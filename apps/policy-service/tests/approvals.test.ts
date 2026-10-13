import request from "supertest";
import { randomUUID } from "node:crypto";
import { ApprovalsService } from "../src/services/approvals.service";
import type { ApprovalResumeHandler } from "../src/services/approval-resume-handler";
import { InMemoryApprovalsRepository } from "./support/in-memory-approvals.repository";
import { buildPrincipal, issueTokenFor } from "./support/fixtures";
import { buildTestApp } from "./support/test-app";

describe("Approval workflow — /v1/approvals", () => {
  function buildApp(resumeHandler?: ApprovalResumeHandler) {
    const repository = new InMemoryApprovalsRepository();
    const service = new ApprovalsService(repository, resumeHandler);
    const app = buildTestApp({ approvalsService: service });
    return { app, repository, service };
  }

  test("ORGANIZATION_ADMIN can approve a pending approval and the resume handler is invoked", async () => {
    const resumeHandler: ApprovalResumeHandler = { onApprovalDecided: jest.fn().mockResolvedValue(undefined) };
    const { app, repository } = buildApp(resumeHandler);
    const principal = buildPrincipal("ORGANIZATION_ADMIN");
    const token = issueTokenFor(principal);

    const approval = await repository.create({
      organizationId: principal.organizationId,
      aiRequestId: "ai-req-1",
      policyId: "policy_default",
      matchedRuleId: "require-approval-sensitive",
      requesterId: principal.userId,
      reason: "SENSITIVE_KEYWORD detected",
    });

    const res = await request(app).post(`/approvals/${approval.id}/approve`).set("Authorization", `Bearer ${token}`).send({ reason: "Looks fine" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("APPROVED");
    expect(res.body.data.decidedBy).toBe(principal.userId);
    expect(resumeHandler.onApprovalDecided).toHaveBeenCalledWith("ai-req-1", "APPROVED", "Looks fine");
  });

  test("ORGANIZATION_ADMIN can reject a pending approval and the resume handler is invoked", async () => {
    const resumeHandler: ApprovalResumeHandler = { onApprovalDecided: jest.fn().mockResolvedValue(undefined) };
    const { app, repository } = buildApp(resumeHandler);
    const principal = buildPrincipal("ORGANIZATION_ADMIN");
    const token = issueTokenFor(principal);

    const approval = await repository.create({
      organizationId: principal.organizationId,
      aiRequestId: "ai-req-2",
      policyId: "policy_default",
      matchedRuleId: "require-approval-sensitive",
      requesterId: principal.userId,
      reason: "SENSITIVE_KEYWORD detected",
    });

    const res = await request(app).post(`/approvals/${approval.id}/reject`).set("Authorization", `Bearer ${token}`).send({ reason: "Not appropriate" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("REJECTED");
    expect(resumeHandler.onApprovalDecided).toHaveBeenCalledWith("ai-req-2", "REJECTED", "Not appropriate");
  });

  test("deciding an already-decided approval returns 409", async () => {
    const { app, repository } = buildApp();
    const principal = buildPrincipal("ORGANIZATION_ADMIN");
    const token = issueTokenFor(principal);
    const approval = await repository.create({
      organizationId: principal.organizationId,
      aiRequestId: "ai-req-3",
      policyId: "policy_default",
      matchedRuleId: null,
      requesterId: principal.userId,
      reason: "test",
    });

    await request(app).post(`/approvals/${approval.id}/approve`).set("Authorization", `Bearer ${token}`).send({});
    const second = await request(app).post(`/approvals/${approval.id}/reject`).set("Authorization", `Bearer ${token}`).send({});

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("APPROVAL_ALREADY_DECIDED");
  });

  test("DEVELOPER can read approvals but cannot decide them (403)", async () => {
    const { app, repository } = buildApp();
    const principal = buildPrincipal("ORGANIZATION_ADMIN");
    const approval = await repository.create({
      organizationId: principal.organizationId,
      aiRequestId: "ai-req-4",
      policyId: "policy_default",
      matchedRuleId: null,
      requesterId: principal.userId,
      reason: "test",
    });

    const devToken = issueTokenFor(buildPrincipal("DEVELOPER", principal.organizationId));
    const listRes = await request(app).get("/approvals").set("Authorization", `Bearer ${devToken}`);
    expect(listRes.status).toBe(200);

    const decideRes = await request(app).post(`/approvals/${approval.id}/approve`).set("Authorization", `Bearer ${devToken}`).send({});
    expect(decideRes.status).toBe(403);
  });

  test("an approval in another organization is 404, not 403", async () => {
    const { app, repository } = buildApp();
    const owner = buildPrincipal("ORGANIZATION_ADMIN");
    const approval = await repository.create({
      organizationId: owner.organizationId,
      aiRequestId: "ai-req-5",
      policyId: "policy_default",
      matchedRuleId: null,
      requesterId: owner.userId,
      reason: "test",
    });

    const otherToken = issueTokenFor(buildPrincipal("ORGANIZATION_ADMIN"));
    const res = await request(app).get(`/approvals/${approval.id}`).set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("APPROVAL_NOT_FOUND");
  });

  test("GET /approvals?status=PENDING filters correctly", async () => {
    const { app, repository } = buildApp();
    const principal = buildPrincipal("ORGANIZATION_ADMIN");
    const token = issueTokenFor(principal);
    const pending = await repository.create({
      organizationId: principal.organizationId,
      aiRequestId: randomUUID(),
      policyId: "policy_default",
      matchedRuleId: null,
      requesterId: principal.userId,
      reason: "pending one",
    });
    const approvedOne = await repository.create({
      organizationId: principal.organizationId,
      aiRequestId: randomUUID(),
      policyId: "policy_default",
      matchedRuleId: null,
      requesterId: principal.userId,
      reason: "approved one",
    });
    await request(app).post(`/approvals/${approvedOne.id}/approve`).set("Authorization", `Bearer ${token}`).send({});

    const res = await request(app).get("/approvals?status=PENDING").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(pending.id);
  });
});
