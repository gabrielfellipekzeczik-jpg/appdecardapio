export function findNewOrderIds(previousIds: number[], currentIds: number[]) {
  const previous = new Set(previousIds);
  return currentIds.filter((id) => !previous.has(id));
}
