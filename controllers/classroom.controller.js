const ClassroomResource = require("../models/ClassroomResource");
const StudentNote = require("../models/StudentNote");
const TeacherAssignment = require("../models/TeacherAssignment");
const ExamAssignment = require("../models/ExamAssignment");
const ExamSubmission = require("../models/ExamSubmission");
const User = require("../models/User");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const pageParams = (query) => ({
  page: Math.max(1, Number(query.page) || 1),
  limit: Math.min(100, Math.max(1, Number(query.limit) || 25)),
});

const getAssignedClass = async ({ teacherEmail, board, className, subject }) => {
  const assignment = await TeacherAssignment.findOne({
    teacherEmail: normalizeEmail(teacherEmail),
    board,
    "classes.className": String(className),
    active: true,
  }).lean();
  const assignedClass = assignment?.classes?.find((entry) => String(entry.className) === String(className));
  if (!assignedClass) return null;
  if (assignedClass.subjects?.length && subject && !assignedClass.subjects.includes(subject)) return null;
  return assignedClass;
};

exports.createResource = async (req, res) => {
  try {
    const { teacherEmail, teacherName, board, className, subject, title, description, driveUrl, deadline } = req.body;
    if (!teacherEmail || !board || !className || !subject || !title || !driveUrl || !deadline) {
      return res.status(400).json({ success: false, error: "Teacher, class, subject, title, Drive link and deadline are required." });
    }
    if (!/^https?:\/\//i.test(driveUrl)) {
      return res.status(400).json({ success: false, error: "Enter a valid http(s) Drive or resource link." });
    }
    if (!(await getAssignedClass({ teacherEmail, board, className, subject }))) {
      return res.status(403).json({ success: false, error: "This class and subject are not assigned to the teacher." });
    }
    const resource = await ClassroomResource.create({
      teacherEmail: normalizeEmail(teacherEmail), teacherName, board, className, subject,
      title, description, driveUrl, deadline,
    });
    return res.status(201).json({ success: true, data: resource });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getResources = async (req, res) => {
  try {
    const { teacherEmail, board, className, subject } = req.query;
    const filter = { status: "published" };
    if (teacherEmail) filter.teacherEmail = normalizeEmail(teacherEmail);
    if (board) filter.board = board;
    if (className) filter.className = String(className);
    if (subject) filter.subject = subject;
    const { page, limit } = pageParams(req.query);
    const [data, total] = await Promise.all([
      ClassroomResource.find(filter).sort({ deadline: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ClassroomResource.countDocuments(filter),
    ]);
    return res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.archiveResource = async (req, res) => {
  try {
    const teacherEmail = normalizeEmail(req.body.teacherEmail);
    const resource = await ClassroomResource.findOneAndUpdate(
      { _id: req.params.resourceId, teacherEmail },
      { $set: { status: "archived" } },
      { new: true }
    );
    if (!resource) return res.status(404).json({ success: false, error: "Resource not found." });
    return res.json({ success: true, data: resource });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.addStudentNote = async (req, res) => {
  try {
    const { teacherEmail, studentId, board, className, subject, comment } = req.body;
    if (!teacherEmail || !studentId || !board || !className || !subject || !comment?.trim()) {
      return res.status(400).json({ success: false, error: "Student, class, subject and comment are required." });
    }
    if (!(await getAssignedClass({ teacherEmail, board, className, subject }))) {
      return res.status(403).json({ success: false, error: "This class and subject are not assigned to the teacher." });
    }
    const student = await User.findOne({ _id: studentId, board, studentClass: String(className), role: "user" }).lean();
    if (!student) return res.status(404).json({ success: false, error: "Student was not found in this class." });
    const note = await StudentNote.create({
      teacherEmail: normalizeEmail(teacherEmail), student: student._id, studentEmail: student.email,
      board, className, subject, comment,
    });
    return res.status(201).json({ success: true, data: note });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getStudentNotes = async (req, res) => {
  try {
    const filter = {};
    if (req.query.teacherEmail) filter.teacherEmail = normalizeEmail(req.query.teacherEmail);
    if (req.query.studentId) filter.student = req.query.studentId;
    if (req.query.subject) filter.subject = req.query.subject;
    const { page, limit } = pageParams(req.query);
    const data = await StudentNote.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getTeacherSubmissions = async (req, res) => {
  try {
    const teacherEmail = normalizeEmail(req.query.teacherEmail);
    const assignments = await ExamAssignment.find({ createdByEmail: teacherEmail }).select("_id title subject className dueAt").lean();
    const assignmentMap = new Map(assignments.map((item) => [String(item._id), item]));
    const { page, limit } = pageParams(req.query);
    const submissions = await ExamSubmission.find({ assignment: { $in: assignments.map((item) => item._id) } })
      .sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return res.json({
      success: true,
      data: submissions.map((item) => ({ ...item, assignmentDetails: assignmentMap.get(String(item.assignment)) })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.gradeSubmission = async (req, res) => {
  try {
    const { teacherEmail, grade, feedback } = req.body;
    const submission = await ExamSubmission.findById(req.params.submissionId).populate("assignment", "createdByEmail");
    if (!submission) return res.status(404).json({ success: false, error: "Submission not found." });
    if (normalizeEmail(submission.assignment?.createdByEmail) !== normalizeEmail(teacherEmail)) {
      return res.status(403).json({ success: false, error: "Only the assigning teacher can grade this submission." });
    }
    submission.grade = grade || "";
    submission.feedback = feedback || "";
    submission.gradedBy = normalizeEmail(teacherEmail);
    submission.gradedAt = new Date();
    submission.status = "graded";
    await submission.save();
    return res.json({ success: true, data: submission });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
