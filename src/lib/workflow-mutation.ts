export class WorkflowConflictError extends Error {
  constructor() {
    super("The workflow changed before this request was completed.");
    this.name = "WorkflowConflictError";
  }
}

export function requireWorkflowClaim(result: { count: number }) {
  if (result.count !== 1) {
    throw new WorkflowConflictError();
  }
}
