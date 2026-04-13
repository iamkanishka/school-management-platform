const asyncHandler = require("express-async-handler");
const {
  getAllStudents,
  addNewStudent,
  getStudentDetail,
  setStudentStatus,
  updateStudent,
} = require("./students-service");

// GET /api/v1/students
const handleGetAllStudents = asyncHandler(async (req, res) => {
  const students = await getAllStudents(req.query);

  res.json({ students: students });
});

// POST /api/v1/students
const handleAddStudent = asyncHandler(async (req, res) => {
  const result = await addNewStudent(req.body);

  res.json(result.message);
});

// PUT /api/v1/students/:id
const handleUpdateStudent = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    userId: req.params.id,
  };

  const result = await updateStudent(payload);

  res.json(result.message);
});

// GET /api/v1/students/:id
const handleGetStudentDetail = asyncHandler(async (req, res) => {
  const student = await getStudentDetail(req.params.id);

  res.json(student);
});

// PATCH /api/v1/students/:id/status
const handleStudentStatus = asyncHandler(async (req, res) => {
  const payload = {
    userId: req.params.id,
    reviewerId: req.user?.id, // from auth middleware
    status: req.body.status,
  };

  const result = await setStudentStatus(payload);

  res.json(result.message);
});

// GET /api/internal/students/:id
const handleInternalGetStudentDetail = asyncHandler(async (req, res) => {
  const student = await getStudentDetail(req.params.id);

  res.json(student);
});

module.exports = {
  handleGetAllStudents,
  handleGetStudentDetail,
  handleAddStudent,
  handleStudentStatus,
  handleUpdateStudent,
  handleInternalGetStudentDetail
};
