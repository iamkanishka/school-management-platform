const { ApiError, sendAccountVerificationEmail } = require("../../utils");
const { findAllStudents, findStudentDetail, findStudentToSetStatus, addOrUpdateStudent } = require("./students-repository");
const { findUserById } = require("../../shared/repository");

const ADD_STUDENT_AND_EMAIL_SEND_SUCCESS = "Student added and verification email sent successfully.";
const ADD_STUDENT_AND_BUT_EMAIL_SEND_FAIL = "Student added, but failed to send verification email.";

const checkStudentId = async (id) => {
    const isStudentFound = await findUserById(id);
    if (!isStudentFound) {
        throw new ApiError(404, "Student not found");
    }
};

const getAllStudents = async (payload) => {
    const students = await findAllStudents(payload);
    return students; // empty array is a valid response, not a 404
};

const getStudentDetail = async (id) => {
    await checkStudentId(id);

    const student = await findStudentDetail(id);
    if (!student) {
        throw new ApiError(404, "Student not found");
    }

    return student;
};

const addNewStudent = async (payload) => {
    // Fix: moved addOrUpdateStudent outside try/catch so ApiError propagates correctly
    const result = await addOrUpdateStudent(payload);
    if (!result.status) {
        throw new ApiError(500, result.message);
    }

    // Only the email sending is wrapped, since its failure is non-critical
    try {
        await sendAccountVerificationEmail({ userId: result.userId, userEmail: payload.email });
        return { message: ADD_STUDENT_AND_EMAIL_SEND_SUCCESS };
    } catch {
        return { message: ADD_STUDENT_AND_BUT_EMAIL_SEND_FAIL };
    }
};

const updateStudent = async (payload) => {
    const result = await addOrUpdateStudent(payload);
    if (!result.status) {
        throw new ApiError(500, result.message);
    }

    return { message: result.message };
};

const setStudentStatus = async ({ userId, reviewerId, status }) => {
    await checkStudentId(userId);

    const affectedRow = await findStudentToSetStatus({ userId, reviewerId, status });
    if (affectedRow <= 0) {
        throw new ApiError(500, "Unable to update student status"); // Fix: was hardcoded "disable"
    }

    return { message: "Student status changed successfully" };
};

module.exports = {
    getAllStudents,
    getStudentDetail,
    addNewStudent,
    setStudentStatus,
    updateStudent,
};