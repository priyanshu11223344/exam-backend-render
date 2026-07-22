module.exports = ({ isAdmin, subscriptionScope }, board, subject) => {
  if (isAdmin) return true;
  const scopedBoard = String(subscriptionScope?.board || "").trim();
  const scopedSubjects = subscriptionScope?.subjects || [];
  if (scopedBoard && board && scopedBoard !== board) return false;
  if (scopedSubjects.length && subject && !scopedSubjects.includes(subject)) return false;
  return true;
};
