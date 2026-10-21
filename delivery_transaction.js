/* Dependency-free delivery transaction guard shared by the browser game and Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PrototypeDeliveryTransactions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function postDelivery(options) {
    const load = options && options.load;
    const cash = options && options.cash;
    const operationId = options && options.operationId;
    const postedOperationIds = options && options.postedOperationIds;
    const recordingEnabled = !options || options.recordingEnabled !== false;
    const commitCash = options && options.commitCash;
    const attemptsByOperationId = options && options.attemptsByOperationId;
    const recoveryRequiredOperationIds = options && options.recoveryRequiredOperationIds;
    if (!load || typeof load.id !== "string" || !load.id.trim() ||
        !Number.isFinite(load.revenue) || load.revenue < 0 ||
        !Number.isFinite(load.operatingCost) || load.operatingCost < 0 ||
        !Number.isFinite(cash) || typeof operationId !== "string" || !operationId ||
        typeof commitCash !== "function" || !(postedOperationIds instanceof Set) ||
        !(attemptsByOperationId instanceof Map) || !(recoveryRequiredOperationIds instanceof Set)) {
      return { status: "VALIDATION_FAILED", operationId: operationId || null,
        reason: "Required transaction data is missing or invalid." };
    }
    if (postedOperationIds.has(operationId)) {
      return { status: "DUPLICATE", operationId,
        reason: "This delivery operation has already been posted." };
    }
    if (recoveryRequiredOperationIds.has(operationId)) {
      return { status: "RECOVERY_REQUIRED", operationId,
        attempts: attemptsByOperationId.get(operationId) || 2,
        reason: "The permitted recording retry failed. Stop and review this operation before continuing." };
    }
    function recordingFailure(reason) {
      const attempts = (attemptsByOperationId.get(operationId) || 0) + 1;
      attemptsByOperationId.set(operationId, attempts);
      if (attempts >= 2) {
        recoveryRequiredOperationIds.add(operationId);
        return { status: "RECOVERY_REQUIRED", operationId, attempts, reason };
      }
      return { status: "RECORDING_FAILED", operationId, attempts, reason };
    }
    const net = load.revenue - load.operatingCost;
    const nextCash = cash + net;
    if (!Number.isFinite(net) || !Number.isFinite(nextCash)) {
      return { status: "VALIDATION_FAILED", operationId,
        reason: "The calculated financial result is not a finite number." };
    }
    if (!recordingEnabled) {
      return recordingFailure("The result could not be recorded; cash was not changed.");
    }
    try {
      commitCash(nextCash);
    } catch (error) {
      return recordingFailure("Cash update failed; the operation was not marked posted.");
    }
    postedOperationIds.add(operationId);
    attemptsByOperationId.delete(operationId);
    return { status: "POSTED", operationId, revenue: load.revenue,
      operatingCost: load.operatingCost, net, cashBefore: cash, cashAfter: nextCash };
  }
  return { postDelivery };
});
