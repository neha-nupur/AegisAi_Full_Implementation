import { randomUUID } from "node:crypto";
import type { ApprovalCreator } from "../../src/services/ai-requests.service";

/** Records every approval-creation call for assertions. Test-only. */
export class FakeApprovalCreator implements ApprovalCreator {
  readonly calls: Parameters<ApprovalCreator["create"]>[0][] = [];

  async create(input: Parameters<ApprovalCreator["create"]>[0]): Promise<{ id: string }> {
    this.calls.push(input);
    return { id: randomUUID() };
  }
}
