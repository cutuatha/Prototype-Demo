(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PrototypeLoadAvailability = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function canAcceptLoad(loadId, completedLoadIds) {
    return typeof loadId === "string" &&
      loadId.trim().length > 0 &&
      completedLoadIds instanceof Set &&
      !completedLoadIds.has(loadId);
  }

  function markLoadCompleted(loadId, completedLoadIds) {
    if (typeof loadId !== "string" ||
        !loadId.trim() ||
        !(completedLoadIds instanceof Set)) {
      return false;
    }
    completedLoadIds.add(loadId);
    return true;
  }

  return { canAcceptLoad, markLoadCompleted };
});
