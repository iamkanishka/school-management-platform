const { Client } = require("pg");
const { faker } = require("@faker-js/faker");

// ─── DB CONFIG ────────────────────────────────────────────────────────────────

const DB_NAME = "school_mgmt";

const adminClient = new Client({
  host: "postgres",
  user: "postgres",
  password: "postgres",
  database: "postgres",
});

const client = new Client({
  host: "postgres",
  user: "postgres",
  password: "postgres",
  database: DB_NAME,
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const phone10 = () => String(faker.number.int({ min: 6000000000, max: 9999999999 }));
const safeStr = (str, max) => str.slice(0, max);

// ─── CREATE DATABASE ──────────────────────────────────────────────────────────

async function createDatabase() {
  await adminClient.connect();
  const res = await adminClient.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [DB_NAME]
  );
  if (res.rowCount === 0) {
    console.log("🛠  Creating database...");
    await adminClient.query(`CREATE DATABASE ${DB_NAME}`);
  } else {
    console.log("✅ Database already exists");
  }
  await adminClient.end();
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────

async function createSchema() {
  console.log("🛠  Creating schema...");

  await client.query(`
    CREATE TABLE IF NOT EXISTS classes (
      id       SERIAL PRIMARY KEY,
      name     VARCHAR(50) UNIQUE,
      sections VARCHAR(50)
    );

    CREATE TABLE IF NOT EXISTS departments (
      id   SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS sections (
      id   SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS leave_policies (
      id        SERIAL PRIMARY KEY,
      name      VARCHAR(50) NOT NULL,
      is_active BOOLEAN DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS roles (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(50) UNIQUE,
      is_active   BOOLEAN DEFAULT true,
      is_editable BOOLEAN DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS users (
      id                      SERIAL PRIMARY KEY,
      name                    VARCHAR(100) NOT NULL,
      email                   VARCHAR(100) NOT NULL UNIQUE,
      password                VARCHAR(255) DEFAULT NULL,
      last_login              TIMESTAMP DEFAULT NULL,
      role_id                 INTEGER REFERENCES roles(id),
      created_dt              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_dt              TIMESTAMP DEFAULT NULL,
      leave_policy_id         INTEGER REFERENCES leave_policies(id) DEFAULT NULL,
      is_active               BOOLEAN DEFAULT false,
      reporter_id             INTEGER DEFAULT NULL,
      status_last_reviewed_dt TIMESTAMP DEFAULT NULL,
      status_last_reviewer_id INTEGER REFERENCES users(id) DEFAULT NULL,
      is_email_verified       BOOLEAN DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id              INTEGER PRIMARY KEY REFERENCES users(id),
      gender               VARCHAR(10) DEFAULT NULL,
      marital_status       VARCHAR(50) DEFAULT NULL,
      join_dt              DATE DEFAULT NULL,
      qualification        VARCHAR(100) DEFAULT NULL,
      experience           VARCHAR(100) DEFAULT NULL,
      dob                  DATE DEFAULT NULL,
      phone                VARCHAR(20) DEFAULT NULL,
      class_name           VARCHAR(50) REFERENCES classes(name)
                             ON UPDATE CASCADE ON DELETE SET NULL DEFAULT NULL,
      section_name         VARCHAR(50) REFERENCES sections(name)
                             ON UPDATE CASCADE ON DELETE SET NULL DEFAULT NULL,
      roll                 INTEGER DEFAULT NULL,
      department_id        INTEGER REFERENCES departments(id)
                             ON UPDATE CASCADE ON DELETE SET NULL DEFAULT NULL,
      admission_dt         DATE DEFAULT NULL,
      father_name          VARCHAR(50) DEFAULT NULL,
      father_phone         VARCHAR(20) DEFAULT NULL,
      mother_name          VARCHAR(50) DEFAULT NULL,
      mother_phone         VARCHAR(20) DEFAULT NULL,
      guardian_name        VARCHAR(50) DEFAULT NULL,
      guardian_phone       VARCHAR(20) DEFAULT NULL,
      emergency_phone      VARCHAR(20) DEFAULT NULL,
      relation_of_guardian VARCHAR(30) DEFAULT NULL,
      current_address      VARCHAR(50) DEFAULT NULL,
      permanent_address    VARCHAR(50) DEFAULT NULL,
      created_dt           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_dt           TIMESTAMP DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS access_controls (
      id           SERIAL PRIMARY KEY,
      name         VARCHAR(100) NOT NULL,
      path         VARCHAR(100) DEFAULT NULL,
      icon         VARCHAR(100) DEFAULT NULL,
      parent_path  VARCHAR(100) DEFAULT NULL,
      hierarchy_id INTEGER DEFAULT NULL,
      type         VARCHAR(50) DEFAULT NULL,
      method       VARCHAR(10) DEFAULT NULL,
      UNIQUE(path, method)
    );

    CREATE TABLE IF NOT EXISTS leave_status (
      id   SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_leaves (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER REFERENCES users(id) NOT NULL,
      leave_policy_id INTEGER REFERENCES leave_policies(id) DEFAULT NULL,
      from_dt         DATE NOT NULL,
      to_dt           DATE NOT NULL,
      note            VARCHAR(100),
      submitted_dt    TIMESTAMP DEFAULT NULL,
      updated_dt      TIMESTAMP DEFAULT NULL,
      approved_dt     TIMESTAMP DEFAULT NULL,
      approver_id     INTEGER REFERENCES users(id),
      status          INTEGER REFERENCES leave_status(id)
    );

    CREATE TABLE IF NOT EXISTS class_teachers (
      id           SERIAL PRIMARY KEY,
      teacher_id   INTEGER REFERENCES users(id),
      class_name   VARCHAR(50) REFERENCES classes(name)
                     ON UPDATE CASCADE ON DELETE SET NULL,
      section_name VARCHAR(30) REFERENCES sections(name)
                     ON UPDATE CASCADE ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notice_status (
      id    SERIAL PRIMARY KEY,
      name  VARCHAR(50) NOT NULL UNIQUE,
      alias VARCHAR(50) NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS notices (
      id                    SERIAL PRIMARY KEY,
      author_id             INTEGER REFERENCES users(id),
      title                 VARCHAR(100) NOT NULL,
      description           VARCHAR(400) NOT NULL,
      status                INTEGER REFERENCES notice_status(id) DEFAULT NULL,
      created_dt            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_dt            TIMESTAMP DEFAULT NULL,
      reviewed_dt           TIMESTAMP DEFAULT NULL,
      reviewer_id           INTEGER REFERENCES users(id) DEFAULT NULL,
      recipient_type        VARCHAR(20) NOT NULL,
      recipient_role_id     INTEGER DEFAULT NULL,
      recipient_first_field VARCHAR(20) DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS user_refresh_tokens (
      id         SERIAL PRIMARY KEY,
      token      TEXT NOT NULL,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      issued_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id                SERIAL PRIMARY KEY,
      role_id           INTEGER REFERENCES roles(id),
      access_control_id INTEGER REFERENCES access_controls(id),
      type              VARCHAR(20) DEFAULT NULL,
      UNIQUE(role_id, access_control_id)
    );

    CREATE TABLE IF NOT EXISTS notice_recipient_types (
      id                       SERIAL PRIMARY KEY,
      role_id                  INTEGER REFERENCES roles(id),
      primary_dependent_name   VARCHAR(100) DEFAULT NULL,
      primary_dependent_select VARCHAR(100) DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS user_leave_policy (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER REFERENCES users(id) DEFAULT NULL,
      leave_policy_id INTEGER REFERENCES leave_policies(id) DEFAULT NULL,
      UNIQUE(user_id, leave_policy_id)
    );
  `);

  // stored functions
  await client.query(`
    DROP FUNCTION IF EXISTS staff_add_update(JSONB);
    CREATE OR REPLACE FUNCTION public.staff_add_update(data jsonb)
    RETURNS TABLE("userId" INTEGER, status boolean, message TEXT, description TEXT)
    LANGUAGE 'plpgsql' AS $FN$
    DECLARE
        _operationType VARCHAR(10);
        _userId INTEGER; _name TEXT; _role INTEGER; _gender TEXT;
        _maritalStatus TEXT; _phone TEXT; _email TEXT; _dob DATE;
        _joinDate DATE; _qualification TEXT; _experience TEXT;
        _currentAddress TEXT; _permanentAddress TEXT;
        _fatherName TEXT; _motherName TEXT; _emergencyPhone TEXT;
        _systemAccess BOOLEAN; _reporterId INTEGER;
    BEGIN
        _userId        := COALESCE((data->>'userId')::INTEGER, NULL);
        _name          := COALESCE(data->>'name', NULL);
        _role          := COALESCE((data->>'role')::INTEGER, NULL);
        _gender        := COALESCE(data->>'gender', NULL);
        _maritalStatus := COALESCE(data->>'maritalStatus', NULL);
        _phone         := COALESCE(data->>'phone', NULL);
        _email         := COALESCE(data->>'email', NULL);
        _dob           := COALESCE((data->>'dob')::DATE, NULL);
        _joinDate      := COALESCE((data->>'joinDate')::DATE, NULL);
        _qualification := COALESCE(data->>'qualification', NULL);
        _experience    := COALESCE(data->>'experience', NULL);
        _currentAddress   := COALESCE(data->>'currentAddress', NULL);
        _permanentAddress := COALESCE(data->>'permanentAddress', NULL);
        _fatherName    := COALESCE(data->>'fatherName', NULL);
        _motherName    := COALESCE(data->>'motherName', NULL);
        _emergencyPhone := COALESCE(data->>'emergencyPhone', NULL);
        _systemAccess  := COALESCE((data->>'systemAccess')::BOOLEAN, NULL);
        _reporterId    := COALESCE((data->>'reporterId')::INTEGER, NULL);
        IF _userId IS NULL THEN _operationType := 'add';
        ELSE _operationType := 'update'; END IF;
        IF _role = 3 THEN
            RETURN QUERY SELECT NULL::INTEGER, false, 'Student cannot be staff', NULL::TEXT;
            RETURN;
        END IF;
        IF NOT EXISTS(SELECT 1 FROM users WHERE id = _userId) THEN
            IF EXISTS(SELECT 1 FROM users WHERE email = _email) THEN
                RETURN QUERY SELECT NULL::INTEGER, false, 'Email already exists', NULL::TEXT;
                RETURN;
            END IF;
            INSERT INTO users (name,email,role_id,created_dt,reporter_id)
            VALUES (_name,_email,_role,now(),_reporterId) RETURNING id INTO _userId;
            INSERT INTO user_profiles
            (user_id,gender,marital_status,phone,dob,join_dt,qualification,experience,
             current_address,permanent_address,father_name,mother_name,emergency_phone)
            VALUES (_userId,_gender,_maritalStatus,_phone,_dob,_joinDate,_qualification,
             _experience,_currentAddress,_permanentAddress,_fatherName,_motherName,_emergencyPhone);
            RETURN QUERY SELECT _userId, true, 'Staff added successfully', NULL;
            RETURN;
        END IF;
        UPDATE users SET name=_name,email=_email,role_id=_role,is_active=_systemAccess,
            reporter_id=_reporterId,updated_dt=now() WHERE id=_userId;
        UPDATE user_profiles SET gender=_gender,marital_status=_maritalStatus,phone=_phone,
            dob=_dob,join_dt=_joinDate,qualification=_qualification,experience=_experience,
            current_address=_currentAddress,permanent_address=_permanentAddress,
            father_name=_fatherName,mother_name=_motherName,emergency_phone=_emergencyPhone
        WHERE user_id=_userId;
        RETURN QUERY SELECT _userId, true, 'Staff updated successfully', NULL;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT _userId::INTEGER, false, 'Unable to '||_operationType||' staff', SQLERRM;
    END;
    $FN$;
  `);

  await client.query(`
    DROP FUNCTION IF EXISTS student_add_update(JSONB);
    CREATE OR REPLACE FUNCTION public.student_add_update(data jsonb)
    RETURNS TABLE("userId" INTEGER, status boolean, message TEXT, description TEXT)
    LANGUAGE 'plpgsql' AS $FN$
    DECLARE
        _operationType VARCHAR(10); _reporterId INTEGER;
        _userId INTEGER; _name TEXT; _roleId INTEGER; _gender TEXT;
        _phone TEXT; _email TEXT; _dob DATE;
        _currentAddress TEXT; _permanentAddress TEXT;
        _fatherName TEXT; _fatherPhone TEXT; _motherName TEXT; _motherPhone TEXT;
        _guardianName TEXT; _guardianPhone TEXT; _relationOfGuardian TEXT;
        _systemAccess BOOLEAN; _className TEXT; _sectionName TEXT;
        _admissionDt DATE; _roll INTEGER;
    BEGIN
        _roleId := 3;
        _userId            := COALESCE((data->>'userId')::INTEGER, NULL);
        _name              := COALESCE(data->>'name', NULL);
        _gender            := COALESCE(data->>'gender', NULL);
        _phone             := COALESCE(data->>'phone', NULL);
        _email             := COALESCE(data->>'email', NULL);
        _dob               := COALESCE((data->>'dob')::DATE, NULL);
        _currentAddress    := COALESCE(data->>'currentAddress', NULL);
        _permanentAddress  := COALESCE(data->>'permanentAddress', NULL);
        _fatherName        := COALESCE(data->>'fatherName', NULL);
        _fatherPhone       := COALESCE(data->>'fatherPhone', NULL);
        _motherName        := COALESCE(data->>'motherName', NULL);
        _motherPhone       := COALESCE(data->>'motherPhone', NULL);
        _guardianName      := COALESCE(data->>'guardianName', NULL);
        _guardianPhone     := COALESCE(data->>'guardianPhone', NULL);
        _relationOfGuardian := COALESCE(data->>'relationOfGuardian', NULL);
        _systemAccess      := COALESCE((data->>'systemAccess')::BOOLEAN, NULL);
        _className         := COALESCE(data->>'class', NULL);
        _sectionName       := COALESCE(data->>'section', NULL);
        _admissionDt       := COALESCE((data->>'admissionDate')::DATE, NULL);
        _roll              := COALESCE((data->>'roll')::INTEGER, NULL);
        IF _userId IS NULL THEN _operationType := 'add';
        ELSE _operationType := 'update'; END IF;
        SELECT teacher_id FROM class_teachers
        WHERE class_name=_className AND section_name=_sectionName INTO _reporterId;
        IF _reporterId IS NULL THEN
            SELECT id FROM users WHERE role_id=1 ORDER BY id ASC LIMIT 1 INTO _reporterId;
        END IF;
        IF NOT EXISTS(SELECT 1 FROM users WHERE id=_userId) THEN
            IF EXISTS(SELECT 1 FROM users WHERE email=_email) THEN
                RETURN QUERY SELECT NULL::INTEGER, false, 'Email already exists', NULL::TEXT;
                RETURN;
            END IF;
            INSERT INTO users (name,email,role_id,created_dt,reporter_id)
            VALUES (_name,_email,_roleId,now(),_reporterId) RETURNING id INTO _userId;
            INSERT INTO user_profiles
            (user_id,gender,phone,dob,admission_dt,class_name,section_name,roll,
             current_address,permanent_address,father_name,father_phone,mother_name,
             mother_phone,guardian_name,guardian_phone,relation_of_guardian)
            VALUES (_userId,_gender,_phone,_dob,_admissionDt,_className,_sectionName,_roll,
             _currentAddress,_permanentAddress,_fatherName,_fatherPhone,_motherName,
             _motherPhone,_guardianName,_guardianPhone,_relationOfGuardian);
            RETURN QUERY SELECT _userId, true, 'Student added successfully', NULL;
            RETURN;
        END IF;
        UPDATE users SET name=_name,email=_email,role_id=_roleId,is_active=_systemAccess,
            updated_dt=now() WHERE id=_userId;
        UPDATE user_profiles SET gender=_gender,phone=_phone,dob=_dob,
            admission_dt=_admissionDt,class_name=_className,section_name=_sectionName,
            roll=_roll,current_address=_currentAddress,permanent_address=_permanentAddress,
            father_name=_fatherName,father_phone=_fatherPhone,mother_name=_motherName,
            mother_phone=_motherPhone,guardian_name=_guardianName,guardian_phone=_guardianPhone,
            relation_of_guardian=_relationOfGuardian
        WHERE user_id=_userId;
        RETURN QUERY SELECT _userId, true, 'Student updated successfully', NULL;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT _userId::INTEGER, false, 'Unable to '||_operationType||' student', SQLERRM;
    END;
    $FN$;
  `);

  // ── NEW: get_notices ──────────────────────────────────────────────────────
  await client.query(`
    DROP FUNCTION IF EXISTS public.get_notices(INTEGER);
    CREATE OR REPLACE FUNCTION get_notices(_user_id INTEGER)
    RETURNS TABLE (
        id INTEGER,
        title VARCHAR(100),
        description VARCHAR(400),
        "authorId" INTEGER,
        "createdDate" TIMESTAMP,
        "updatedDate" TIMESTAMP,
        author VARCHAR(100),
        "reviewerName" VARCHAR(100),
        "reviewedDate" TIMESTAMP,
        status VARCHAR(100),
        "statusId" INTEGER,
        "whoHasAccess" TEXT
    )
    LANGUAGE plpgsql
    AS $FN$
    DECLARE
        _user_role_id INTEGER;
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = _user_id) THEN
            RAISE EXCEPTION 'User does not exist';
        END IF;

        SELECT role_id FROM users u WHERE u.id = _user_id INTO _user_role_id;
        IF _user_role_id IS NULL THEN
            RAISE EXCEPTION 'Role does not exist';
        END IF;

        RETURN QUERY
        SELECT
            t1.id,
            t1.title,
            t1.description,
            t1.author_id AS "authorId",
            t1.created_dt AS "createdDate",
            t1.updated_dt AS "updatedDate",
            t2.name AS author,
            t4.name AS "reviewerName",
            t1.reviewed_dt AS "reviewedDate",
            t3.alias AS "status",
            t1.status AS "statusId",
            NULL::TEXT AS "whoHasAccess"
        FROM notices t1
        LEFT JOIN users t2 ON t1.author_id = t2.id
        LEFT JOIN notice_status t3 ON t1.status = t3.id
        LEFT JOIN users t4 ON t1.reviewer_id = t4.id
        WHERE (
            _user_role_id = 1
            AND (
                t1.author_id = _user_id
                OR (
                    t1.status != 1
                    AND t1.author_id != _user_id
                )
            )
        )
        OR (
            _user_role_id != 1
            AND (
                t1.status != 6
                AND (
                    t1.author_id = _user_id
                    OR (
                        t1.status = 5
                        AND (
                            t1.recipient_type = 'EV'
                            OR (
                                t1.recipient_type = 'SP'
                                AND (
                                    (
                                        t1.recipient_role_id = 2
                                        AND _user_role_id = 2
                                        AND (
                                            t1.recipient_first_field IS NULL
                                            OR t1.recipient_first_field = ''
                                            OR EXISTS (
                                                SELECT 1
                                                FROM user_profiles u
                                                JOIN users t5 ON u.user_id = t5.id
                                                WHERE u.department_id = (t1.recipient_first_field)::INTEGER
                                                AND t5.id = _user_id AND t5.role_id = _user_role_id
                                            )
                                        )
                                    )
                                    OR (
                                        t1.recipient_role_id = 3
                                        AND _user_role_id = 3
                                        AND (
                                            t1.recipient_first_field IS NULL
                                            OR t1.recipient_first_field = ''
                                            OR EXISTS (
                                                SELECT 1
                                                FROM user_profiles u
                                                JOIN users t5 ON u.user_id = t5.id
                                                WHERE u.class_name = t1.recipient_first_field
                                                AND t5.id = _user_id AND t5.role_id = _user_role_id
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
        ORDER BY t1.created_dt DESC;
    END;
    $FN$;
  `);

  // ── NEW: get_dashboard_data ───────────────────────────────────────────────
  await client.query(`
    DROP FUNCTION IF EXISTS public.get_dashboard_data(INTEGER);
    CREATE OR REPLACE FUNCTION get_dashboard_data(_user_id INTEGER)
    RETURNS JSONB
    LANGUAGE plpgsql
    AS $FN$
    DECLARE
        _user_role_id INTEGER;

        _student_count_current_year INTEGER;
        _student_count_previous_year INTEGER;
        _student_value_comparison INTEGER;
        _student_perc_comparison FLOAT;

        _teacher_count_current_year INTEGER;
        _teacher_count_previous_year INTEGER;
        _teacher_value_comparison INTEGER;
        _teacher_perc_comparison FLOAT;

        _parent_count_current_year INTEGER;
        _parent_count_previous_year INTEGER;
        _parent_value_comparison INTEGER;
        _parent_perc_comparison FLOAT;

        _notices_data JSONB;
        _leave_policies_data JSONB;
        _leave_histories_data JSONB;
        _celebrations_data JSONB;
        _one_month_leave_data JSONB;
    BEGIN
        -- user check
        IF NOT EXISTS(SELECT 1 FROM users u WHERE u.id = _user_id) THEN
            RAISE EXCEPTION 'User does not exist';
        END IF;

        SELECT role_id FROM users u WHERE u.id = _user_id into _user_role_id;
        IF _user_role_id IS NULL THEN
            RAISE EXCEPTION 'Role does not exist';
        END IF;

        --student
        IF _user_role_id = 1 THEN
            SELECT COUNT(*) INTO _student_count_current_year
            FROM users t1
            JOIN user_profiles t2 ON t1.id = t2.user_id
            WHERE t1.role_id = 3
            AND EXTRACT(YEAR FROM t2.admission_dt) = EXTRACT(YEAR FROM CURRENT_DATE);

            SELECT COUNT(*) INTO _student_count_previous_year
            FROM users t1
            JOIN user_profiles t2 ON t1.id = t2.user_id
            WHERE t1.role_id = 3
            AND EXTRACT(YEAR FROM t2.admission_dt) = EXTRACT(YEAR FROM CURRENT_DATE) - 1;

            _student_value_comparison := _student_count_current_year - _student_count_previous_year;
            IF _student_count_previous_year = 0 THEN
                _student_perc_comparison := 0;
            ELSE
                _student_perc_comparison := (_student_value_comparison::FLOAT / _student_count_previous_year) * 100;
            END IF;

            --teacher
            SELECT COUNT(*) INTO _teacher_count_current_year
            FROM users t1
            JOIN user_profiles t2 ON t1.id = t2.user_id
            WHERE t1.role_id = 2
            AND EXTRACT(YEAR FROM t2.join_dt) = EXTRACT(YEAR FROM CURRENT_DATE);

            SELECT COUNT(*) INTO _teacher_count_previous_year
            FROM users t1
            JOIN user_profiles t2 ON t1.id = t2.user_id
            WHERE t1.role_id = 2
            AND EXTRACT(YEAR FROM t2.join_dt) = EXTRACT(YEAR FROM CURRENT_DATE) - 1;

            _teacher_value_comparison := _teacher_count_current_year - _teacher_count_previous_year;
            IF _teacher_count_previous_year = 0 THEN
                _teacher_perc_comparison := 0;
            ELSE
                _teacher_perc_comparison := (_teacher_value_comparison::FLOAT / _teacher_count_previous_year) * 100;
            END IF;

            --parents
            SELECT COUNT(*) INTO _parent_count_current_year
            FROM users t1
            JOIN user_profiles t2 ON t1.id = t2.user_id
            WHERE t1.role_id = 4
            AND EXTRACT(YEAR FROM t2.join_dt) = EXTRACT(YEAR FROM CURRENT_DATE);

            SELECT COUNT(*) INTO _parent_count_previous_year
            FROM users t1
            JOIN user_profiles t2 ON t1.id = t2.user_id
            WHERE t1.role_id = 4
            AND EXTRACT(YEAR FROM t2.join_dt) = EXTRACT(YEAR FROM CURRENT_DATE) - 1;

            _parent_value_comparison := _parent_count_current_year - _parent_count_previous_year;
            IF _parent_count_previous_year = 0 THEN
                _parent_perc_comparison := 0;
            ELSE
                _parent_perc_comparison := (_parent_value_comparison::FLOAT / _parent_count_previous_year) * 100;
            END IF;
        ELSE
            _student_count_current_year := 0::INTEGER;
            _student_perc_comparison := 0::FLOAT;
            _student_value_comparison := 0::INTEGER;

            _teacher_count_current_year := 0::INTEGER;
            _teacher_perc_comparison := 0::FLOAT;
            _teacher_value_comparison := 0::INTEGER;

            _parent_count_current_year := 0::INTEGER;
            _parent_perc_comparison := 0::FLOAT;
            _parent_value_comparison := 0::INTEGER;
        END IF;

        -- get notices
        SELECT
            COALESCE(JSON_AGG(row_to_json(t)), '[]'::json)
        INTO _notices_data
        FROM (
            SELECT *
            FROM get_notices(_user_id) AS t
            LIMIT 5
        ) AS t;

        --leave polices
        WITH _leave_policies_query AS (
            SELECT
                t2.id,
                t2.name,
                COALESCE(SUM(
                    CASE WHEN t3.status = 2 THEN
                        EXTRACT(DAY FROM age(t3.to_dt + INTERVAL '1 day', t3.from_dt))
                    ELSE 0
                    END
                ), 0) AS "totalDaysUsed"
            FROM user_leave_policy t1
            JOIN leave_policies t2 ON t1.leave_policy_id = t2.id
            LEFT JOIN user_leaves t3 ON t1.leave_policy_id = t3.leave_policy_id
            WHERE t1.user_id = _user_id
            GROUP BY t2.id, t2.name
        )
        SELECT
            COALESCE(JSON_AGG(row_to_json(t)), '[]'::json)
        INTO _leave_policies_data
        FROM _leave_policies_query AS t;

        --leave history
        WITH _leave_history_query AS (
            SELECT
                t1.id,
                t2.name AS policy,
                t1.leave_policy_id AS "policyId",
                t1.from_dt AS "from",
                t1.to_dt AS "to",
                t1.note,
                t3.name AS status,
                t1.submitted_dt AS "submitted",
                t1.updated_dt AS "updated",
                t1.approved_dt AS "approved",
                t4.name AS approver,
                t5.name AS user,
                EXTRACT(DAY FROM age(t1.to_dt + INTERVAL '1 day', t1.from_dt)) AS days
            FROM user_leaves t1
            JOIN leave_policies t2 ON t1.leave_policy_id = t2.id
            JOIN leave_status t3 ON t1.status = t3.id
            LEFT JOIN users t4 ON t1.approver_id = t4.id
            JOIN users t5 ON t1.user_id = t5.id
            WHERE (
                _user_role_id = 1
                And 1=1
            ) OR (
                _user_role_id != 1
                AND t1.user_id = _user_id
            )
            ORDER BY submitted_dt DESC
            LIMIT 5
        )
        SELECT
            COALESCE(JSON_AGG(row_to_json(t)), '[]'::json)
        INTO _leave_histories_data
        FROM _leave_history_query AS t;

        --celebrations
        WITH _celebrations AS (
            SELECT
                t1.id AS "userId",
                t1.name AS user,
                'Happy Birthday!' AS event,
                t2.dob AS "eventDate"
            FROM users t1
            JOIN user_profiles t2 ON t1.id = t2.user_id
            WHERE t2.dob IS NOT NULL
            AND (
                t2.dob + (EXTRACT(YEAR FROM age(now(), t2.dob)) + 1) * INTERVAL '1 year'
                BETWEEN now() AND now() + INTERVAL '90 days'
            )

            UNION ALL

            SELECT
                t1.id AS "userId",
                t1.name AS user,
                'Happy ' ||
                    CASE
                        WHEN t1.role_id = 3 THEN
                            EXTRACT(YEAR FROM age(now(), t2.admission_dt))
                        ELSE
                            EXTRACT(YEAR FROM age(now(), t2.join_dt))
                    END || ' Anniversary!' AS event,
                CASE
                    WHEN t1.role_id = 3 THEN
                        t2.admission_dt
                    ELSE
                        t2.join_dt
                END AS "eventDate"
            FROM users t1
            JOIN user_profiles t2 ON t1.id = t2.user_id
            WHERE
            (
                t1.role_id = 3
                AND t2.admission_dt IS NOT NULL
                AND age(now(), t2.admission_dt) >= INTERVAL '1 year'
                AND (
                    (t2.admission_dt +
                    (EXTRACT(YEAR FROM age(now(), t2.admission_dt)) + 1 ) * INTERVAL '1 year')
                    BETWEEN now() AND now() + '90 days'
                )
            )
            OR
            (
                t1.role_id != 3
                AND t2.join_dt IS NOT NULL
                AND age(now(), t2.join_dt) >= INTERVAL '1 year'
                AND (
                    (t2.join_dt +
                    (EXTRACT(YEAR FROM age(now(), t2.join_dt)) + 1 ) * INTERVAL '1 year')
                    BETWEEN now() AND now() + '90 days'
                )
            )
        )
        SELECT
            COALESCE(JSON_AGG(row_to_json(t) ORDER BY TO_CHAR(t."eventDate", 'MM-DD') ), '[]'::json)
        INTO _celebrations_data
        FROM _celebrations AS t;

        --who is out this month
        WITH _month_dates AS (
            SELECT
                DATE_TRUNC('day', now()) AS day_start,
                DATE_TRUNC('day', now()) + INTERVAL '30 days' AS day_end
        )
        SELECT
            COALESCE(JSON_AGG(row_to_json(t)), '[]'::json)
        INTO _one_month_leave_data
        FROM (
            SELECT
                t1.id AS "userId",
                t1.name AS user,
                t2.from_dt AS "fromDate",
                t2.to_dt AS "toDate",
                t3.name AS "leaveType"
            FROM users t1
            JOIN user_leaves t2 ON t1.id = t2.user_id
            JOIN leave_policies t3 ON t2.leave_policy_id = t3.id
            JOIN _month_dates t4
            ON
                t2.from_dt <= t4.day_end
                AND t2.to_dt >= t4.day_start
            WHERE t2.status = 2
        )t;

        -- Build and return the final JSON object
        RETURN JSON_BUILD_OBJECT(
            'students', JSON_BUILD_OBJECT(
                'totalNumberCurrentYear', _student_count_current_year,
                'totalNumberPercInComparisonFromPrevYear', _student_perc_comparison,
                'totalNumberValueInComparisonFromPrevYear', _student_value_comparison
            ),
            'teachers', JSON_BUILD_OBJECT(
                'totalNumberCurrentYear', _teacher_count_current_year,
                'totalNumberPercInComparisonFromPrevYear', _teacher_perc_comparison,
                'totalNumberValueInComparisonFromPrevYear', _teacher_value_comparison
            ),
            'parents', JSON_BUILD_OBJECT(
                'totalNumberCurrentYear', _parent_count_current_year,
                'totalNumberPercInComparisonFromPrevYear', _parent_perc_comparison,
                'totalNumberValueInComparisonFromPrevYear', _parent_value_comparison
            ),
            'notices', _notices_data,
            'leavePolicies', _leave_policies_data,
            'leaveHistory', _leave_histories_data,
            'celebrations', _celebrations_data,
            'oneMonthLeave', _one_month_leave_data
        );
    END;
    $FN$;
  `);

  console.log("✅ Schema + stored functions ready");
}

// ─── ROLES ────────────────────────────────────────────────────────────────────

async function seedRoles() {
  console.log("🌱 Seeding roles...");
  await client.query(`ALTER SEQUENCE roles_id_seq RESTART WITH 1`);
  await client.query(`
    INSERT INTO roles (name, is_active, is_editable)
    VALUES ('Admin', true, false), ('Teacher', true, false), ('Student', true, false)
    ON CONFLICT (name) DO NOTHING;
  `);
  console.log("✅ Roles seeded");
}

// ─── LEAVE STATUS ─────────────────────────────────────────────────────────────

async function seedLeaveStatus() {
  console.log("🌱 Seeding leave_status...");
  await client.query(`ALTER SEQUENCE leave_status_id_seq RESTART WITH 1`);
  await client.query(`
    INSERT INTO leave_status (name) VALUES ('On Review'), ('Approved'), ('Cancelled')
    ON CONFLICT DO NOTHING;
  `);
  console.log("✅ Leave status seeded");
}

// ─── NOTICE STATUS ────────────────────────────────────────────────────────────

async function seedNoticeStatus() {
  console.log("🌱 Seeding notice_status...");
  await client.query(`ALTER SEQUENCE notice_status_id_seq RESTART WITH 1`);
  await client.query(`
    INSERT INTO notice_status (name, alias) VALUES
      ('Draft',               'Draft'),
      ('Submit for Review',   'Approval Pending'),
      ('Submit for Deletion', 'Delete Pending'),
      ('Reject',              'Rejected'),
      ('Approve',             'Approved'),
      ('Delete',              'Deleted')
    ON CONFLICT DO NOTHING;
  `);
  console.log("✅ Notice status seeded");
}

// ─── ACCESS CONTROLS ──────────────────────────────────────────────────────────

async function seedAccessControls() {
  console.log("🌱 Seeding access_controls...");
  await client.query(`
    INSERT INTO access_controls (name, path, icon, parent_path, hierarchy_id, type, method) VALUES
      ('Get my account detail',        'account',                               NULL,                       NULL,                    NULL, 'screen',      NULL),
      ('Get permissions',              '/api/v1/permissions',                   NULL,                       NULL,                    NULL, 'api',         'GET'),
      ('Get teachers',                 '/api/v1/teachers',                      NULL,                       NULL,                    NULL, 'api',         'GET'),
      ('Dashboard',                    '',                                      NULL,                       NULL,                    NULL, 'screen',      NULL),
      ('Get dashboard data',           '/api/v1/dashboard',                     NULL,                       '',                      NULL, 'api',         'GET'),
      ('Resend email verification',    '/api/v1/auth/resend-email-verification',NULL,                       NULL,                    NULL, 'api',         'POST'),
      ('Resend password setup link',   '/api/v1/auth/resend-pwd-setup-link',    NULL,                       NULL,                    NULL, 'api',         'POST'),
      ('Reset password',               '/api/v1/auth/reset-pwd',                NULL,                       NULL,                    NULL, 'api',         'POST'),
      ('Leave',                        'leave_parent',                          'leave.svg',                NULL,                    2,    'menu-screen', NULL),
      ('Leave Define',                 'leave/define',                          NULL,                       'leave_parent',          1,    'menu-screen', NULL),
      ('Leave Request',                'leave/request',                         NULL,                       'leave_parent',          2,    'menu-screen', NULL),
      ('Pending Leave Request',        'leave/pending',                         NULL,                       'leave_parent',          3,    'menu-screen', NULL),
      ('Add leave policy',             '/api/v1/leave/policies',                NULL,                       'leave_parent',          NULL, 'api',         'POST'),
      ('Get all leave policies',       '/api/v1/leave/policies',                NULL,                       'leave_parent',          NULL, 'api',         'GET'),
      ('Get my leave policies',        '/api/v1/leave/policies/me',             NULL,                       'leave_parent',          NULL, 'api',         'GET'),
      ('Update leave policy',          '/api/v1/leave/policies/:id',            NULL,                       'leave_parent',          NULL, 'api',         'PUT'),
      ('Handle policy status',         '/api/v1/leave/policies/:id/status',     NULL,                       'leave_parent',          NULL, 'api',         'POST'),
      ('Add user to policy',           '/api/v1/leave/policies/:id/users',      NULL,                       'leave_parent',          NULL, 'api',         'POST'),
      ('Get policy users',             '/api/v1/leave/policies/:id/users',      NULL,                       'leave_parent',          NULL, 'api',         'GET'),
      ('Remove user from policy',      '/api/v1/leave/policies/:id/users',      NULL,                       'leave_parent',          NULL, 'api',         'DELETE'),
      ('Get policy eligible users',    '/api/v1/leave/policies/eligible-users', NULL,                       'leave_parent',          NULL, 'api',         'GET'),
      ('Get user leave history',       '/api/v1/leave/request',                 NULL,                       'leave_parent',          NULL, 'api',         'GET'),
      ('Create new leave request',     '/api/v1/leave/request',                 NULL,                       'leave_parent',          NULL, 'api',         'POST'),
      ('Update leave request',         '/api/v1/leave/request/:id',             NULL,                       'leave_parent',          NULL, 'api',         'PUT'),
      ('Delete leave request',         '/api/v1/leave/request/:id',             NULL,                       'leave_parent',          NULL, 'api',         'DELETE'),
      ('Get pending leave requests',   '/api/v1/leave/pending',                 NULL,                       'leave_parent',          NULL, 'api',         'GET'),
      ('Handle leave request status',  '/api/v1/leave/pending/:id/status',      NULL,                       'leave_parent',          NULL, 'api',         'POST'),
      ('Academics',                    'academics_parent',                      'academics.svg',            NULL,                    3,    'menu-screen', NULL),
      ('Classes',                      'classes',                               NULL,                       'academics_parent',      1,    'menu-screen', NULL),
      ('Class Teachers',               'class-teachers',                        NULL,                       'academics_parent',      2,    'menu-screen', NULL),
      ('Sections',                     'sections',                              NULL,                       'academics_parent',      3,    'menu-screen', NULL),
      ('Classes Edit',                 'classes/edit/:id',                      NULL,                       'academics_parent',      NULL, 'screen',      NULL),
      ('Class Teachers Edit',          'class-teachers/edit/:id',               NULL,                       'academics_parent',      NULL, 'screen',      NULL),
      ('Get all classes',              '/api/v1/classes',                       NULL,                       'academics_parent',      NULL, 'api',         'GET'),
      ('Get class detail',             '/api/v1/classes/:id',                   NULL,                       'academics_parent',      NULL, 'api',         'GET'),
      ('Add new class',                '/api/v1/classes',                       NULL,                       'academics_parent',      NULL, 'api',         'POST'),
      ('Update class detail',          '/api/v1/classes/:id',                   NULL,                       'academics_parent',      NULL, 'api',         'PUT'),
      ('Delete class',                 '/api/v1/classes/:id',                   NULL,                       'academics_parent',      NULL, 'api',         'DELETE'),
      ('Get class with teacher details','/api/v1/class-teachers',               NULL,                       'academics_parent',      NULL, 'api',         'GET'),
      ('Add class teacher',            '/api/v1/class-teachers',                NULL,                       'academics_parent',      NULL, 'api',         'POST'),
      ('Get class teacher detail',     '/api/v1/class-teachers/:id',            NULL,                       'academics_parent',      NULL, 'api',         'GET'),
      ('Update class teacher detail',  '/api/v1/class-teachers/:id',            NULL,                       'academics_parent',      NULL, 'api',         'PUT'),
      ('Section Edit',                 'sections/edit/:id',                     NULL,                       'academics_parent',      NULL, 'screen',      NULL),
      ('Get all sections',             '/api/v1/sections',                      NULL,                       'academics_parent',      NULL, 'api',         'GET'),
      ('Add new section',              '/api/v1/sections',                      NULL,                       'academics_parent',      NULL, 'api',         'POST'),
      ('Get section detail',           '/api/v1/sections/:id',                  NULL,                       'academics_parent',      NULL, 'api',         'GET'),
      ('Update section detail',        '/api/v1/sections/:id',                  NULL,                       'academics_parent',      NULL, 'api',         'PUT'),
      ('Delete section',               '/api/v1/sections/:id',                  NULL,                       'academics_parent',      NULL, 'api',         'DELETE'),
      ('Students',                     'students_parent',                       'students.svg',             NULL,                    4,    'menu-screen', NULL),
      ('Student List',                 'students',                              NULL,                       'students_parent',       1,    'menu-screen', NULL),
      ('Add Student',                  'students/add',                          NULL,                       'students_parent',       2,    'menu-screen', NULL),
      ('View Student',                 'students/:id',                          NULL,                       'students_parent',       NULL, 'screen',      NULL),
      ('Edit Student',                 'students/edit/:id',                     NULL,                       'students_parent',       NULL, 'screen',      NULL),
      ('Get students',                 '/api/v1/students',                      NULL,                       'students_parent',       NULL, 'api',         'GET'),
      ('Add new student',              '/api/v1/students',                      NULL,                       'students_parent',       NULL, 'api',         'POST'),
      ('Get student detail',           '/api/v1/students/:id',                  NULL,                       'students_parent',       NULL, 'api',         'GET'),
      ('Handle student status',        '/api/v1/students/:id/status',           NULL,                       'students_parent',       NULL, 'api',         'POST'),
      ('Update student detail',        '/api/v1/students/:id',                  NULL,                       'students_parent',       NULL, 'api',         'PUT'),
      ('Communication',                'communication_parent',                  'communication.svg',        NULL,                    5,    'menu-screen', NULL),
      ('Notice Board',                 'notices',                               NULL,                       'communication_parent',  1,    'menu-screen', NULL),
      ('Add Notice',                   'notices/add',                           NULL,                       'communication_parent',  2,    'menu-screen', NULL),
      ('Manage Notices',               'notices/manage',                        NULL,                       'communication_parent',  3,    'menu-screen', NULL),
      ('Notice Recipients',            'notices/recipients',                    NULL,                       'communication_parent',  4,    'menu-screen', NULL),
      ('View Notice',                  'notices/:id',                           NULL,                       'communication_parent',  NULL, 'screen',      NULL),
      ('Edit Notice',                  'notices/edit/:id',                      NULL,                       'communication_parent',  NULL, 'screen',      NULL),
      ('Edit Recipient',               'notices/recipients/edit/:id',           NULL,                       'communication_parent',  NULL, 'screen',      NULL),
      ('Get notice recipient list',    '/api/v1/notices/recipients/list',       NULL,                       'communication_parent',  NULL, 'api',         'GET'),
      ('Get notice recipients',        '/api/v1/notices/recipients',            NULL,                       'communication_parent',  NULL, 'api',         'GET'),
      ('Get notice recipient detail',  '/api/v1/notices/recipients/:id',        NULL,                       'communication_parent',  NULL, 'api',         'GET'),
      ('Add new notice recipient',     '/api/v1/notices/recipients',            NULL,                       'communication_parent',  NULL, 'api',         'POST'),
      ('Update notice recipient',      '/api/v1/notices/recipients/:id',        NULL,                       'communication_parent',  NULL, 'api',         'PUT'),
      ('Delete notice recipient',      '/api/v1/notices/recipients/:id',        NULL,                       'communication_parent',  NULL, 'api',         'DELETE'),
      ('Handle notice status',         '/api/v1/notices/:id/status',            NULL,                       'communication_parent',  NULL, 'api',         'POST'),
      ('Get notice detail',            '/api/v1/notices/:id',                   NULL,                       'communication_parent',  NULL, 'api',         'GET'),
      ('Get all notices',              '/api/v1/notices',                       NULL,                       'communication_parent',  NULL, 'api',         'GET'),
      ('Add new notice',               '/api/v1/notices',                       NULL,                       'communication_parent',  NULL, 'api',         'POST'),
      ('Update notice detail',         '/api/v1/notices/:id',                   NULL,                       'communication_parent',  NULL, 'api',         'PUT'),
      ('Human Resource',               'hr_parent',                             'hr.svg',                   NULL,                    6,    'menu-screen', NULL),
      ('Staff List',                   'staffs',                                NULL,                       'hr_parent',             1,    'menu-screen', NULL),
      ('Add Staff',                    'staffs/add',                            NULL,                       'hr_parent',             2,    'menu-screen', NULL),
      ('Departments',                  'departments',                           NULL,                       'hr_parent',             3,    'menu-screen', NULL),
      ('View Staffs',                  'staffs/:id',                            NULL,                       'hr_parent',             NULL, 'screen',      NULL),
      ('Edit Staff',                   'staffs/edit/:id',                       NULL,                       'hr_parent',             NULL, 'screen',      NULL),
      ('Get all staffs',               '/api/v1/staffs',                        NULL,                       'hr_parent',             NULL, 'api',         'GET'),
      ('Add new staff',                '/api/v1/staffs',                        NULL,                       'hr_parent',             NULL, 'api',         'POST'),
      ('Get staff detail',             '/api/v1/staffs/:id',                    NULL,                       'hr_parent',             NULL, 'api',         'GET'),
      ('Update staff detail',          '/api/v1/staffs/:id',                    NULL,                       'hr_parent',             NULL, 'api',         'PUT'),
      ('Handle staff status',          '/api/v1/staffs/:id/status',             NULL,                       'hr_parent',             NULL, 'api',         'POST'),
      ('Edit Department',              'departments/edit/id',                   NULL,                       'hr_parent',             NULL, 'screen',      NULL),
      ('Get all departments',          '/api/v1/departments',                   NULL,                       'hr_parent',             NULL, 'api',         'GET'),
      ('Add new department',           '/api/v1/departments',                   NULL,                       'hr_parent',             NULL, 'api',         'POST'),
      ('Get department detail',        '/api/v1/departments/:id',               NULL,                       'hr_parent',             NULL, 'api',         'GET'),
      ('Update department detail',     '/api/v1/departments/:id',               NULL,                       'hr_parent',             NULL, 'api',         'PUT'),
      ('Delete department',            '/api/v1/departments/:id',               NULL,                       'hr_parent',             NULL, 'api',         'DELETE'),
      ('Access Setting',               'access_setting_parent',                 'rolesAndPermissions.svg',  NULL,                    7,    'menu-screen', NULL),
      ('Roles & Permissions',          'roles-and-permissions',                 NULL,                       'access_setting_parent', 1,    'menu-screen', NULL),
      ('Get all roles',                '/api/v1/roles',                         NULL,                       'access_setting_parent', NULL, 'api',         'GET'),
      ('Add new role',                 '/api/v1/roles',                         NULL,                       'access_setting_parent', NULL, 'api',         'POST'),
      ('Switch user role',             '/api/v1/roles/switch',                  NULL,                       'access_setting_parent', NULL, 'api',         'POST'),
      ('Update role',                  '/api/v1/roles/:id',                     NULL,                       'access_setting_parent', NULL, 'api',         'PUT'),
      ('Handle role status',           '/api/v1/roles/:id/status',              NULL,                       'access_setting_parent', NULL, 'api',         'POST'),
      ('Get role detail',              '/api/v1/roles/:id',                     NULL,                       'access_setting_parent', NULL, 'api',         'GET'),
      ('Get role permissions',         '/api/v1/roles/:id/permissions',         NULL,                       'access_setting_parent', NULL, 'api',         'GET'),
      ('Add role permissions',         '/api/v1/roles/:id/permissions',         NULL,                       'access_setting_parent', NULL, 'api',         'POST'),
      ('Get role users',               '/api/v1/roles/:id/users',               NULL,                       'access_setting_parent', NULL, 'api',         'GET')
    ON CONFLICT (path, method) DO NOTHING;
  `);
  console.log("✅ Access controls seeded");
}

// ─── BASE LOOKUP DATA ─────────────────────────────────────────────────────────

async function seedBase() {
  console.log("🌱 Seeding base lookup data...");

  await client.query(`
    INSERT INTO classes (name) VALUES
      ('Class 1'),('Class 2'),('Class 3'),('Class 4'),('Class 5'),
      ('Class 6'),('Class 7'),('Class 8'),('Class 9'),('Class 10')
    ON CONFLICT DO NOTHING;
  `);

  await client.query(`
    INSERT INTO sections (name) VALUES ('A'),('B'),('C'),('D')
    ON CONFLICT DO NOTHING;
  `);

  await client.query(`
    INSERT INTO departments (name) VALUES
      ('Science'),('Mathematics'),('English'),('History'),
      ('Physical Education'),('Computer Science'),('Arts'),('Commerce')
    ON CONFLICT DO NOTHING;
  `);

  await client.query(`
    INSERT INTO leave_policies (name, is_active) VALUES
      ('Casual Leave',    true),
      ('Sick Leave',      true),
      ('Maternity Leave', true),
      ('Earned Leave',    true)
    ON CONFLICT DO NOTHING;
  `);

  // notice_recipient_types used by get_notices() SP
  await client.query(`
    INSERT INTO notice_recipient_types (role_id, primary_dependent_name, primary_dependent_select)
    VALUES
      (NULL, NULL,         NULL),
      (2,    'Department', 'department'),
      (3,    'Class',      'class')
    ON CONFLICT DO NOTHING;
  `);

  console.log("✅ Base data seeded");
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────

async function seedAdmin() {
  console.log("🌱 Seeding admin user...");

  const hash =
    "$argon2id$v=19$m=65536,t=3,p=4$21a+bDbESEI60WO1wRKnvQ$i6OrxqNiHvwtf1Xg3bfU5+AXZG14fegW3p+RSMvq1oU";

  await client.query(`
    INSERT INTO users (name, email, role_id, password, is_active, is_email_verified, created_dt)
    VALUES ('John Doe', 'admin@school-admin.com', 1, $1, true, true, now())
    ON CONFLICT (email) DO NOTHING;
  `, [hash]);

  const { rows } = await client.query(
    `SELECT id FROM users WHERE email = 'admin@school-admin.com'`
  );
  const adminId = rows[0].id;

  await client.query(`
    INSERT INTO user_profiles
      (user_id, gender, marital_status, phone, dob, join_dt,
       father_name, mother_name, emergency_phone)
    VALUES ($1, 'Male', 'Married', '4759746607', '1985-08-05',
            '2015-01-01', 'Robert Doe', 'Mary Doe', '7937430400')
    ON CONFLICT (user_id) DO NOTHING;
  `, [adminId]);

  console.log(`✅ Admin seeded (id=${adminId})`);
  return adminId;
}

// ─── TEACHERS ─────────────────────────────────────────────────────────────────

async function seedTeachers(count = 15) {
  console.log(`🌱 Seeding ${count} teachers...`);

  const { rows: deptRows } = await client.query(`SELECT id FROM departments`);
  const deptIds = deptRows.map((r) => r.id);

  const { rows: classRows } = await client.query(`SELECT name FROM classes`);
  const classNames = classRows.map((r) => r.name);

  const { rows: secRows } = await client.query(`SELECT name FROM sections`);
  const secNames = secRows.map((r) => r.name);

  const teacherIds = [];

  for (let i = 0; i < count; i++) {
    const { rows, rowCount } = await client.query(
      `INSERT INTO users (name, email, role_id, is_active, is_email_verified, created_dt)
       VALUES ($1, $2, 2, true, true, now())
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      [safeStr(faker.person.fullName(), 100), faker.internet.email()]
    );
    if (rowCount === 0) continue;
    const uid = rows[0].id;
    teacherIds.push(uid);

    await client.query(
      `INSERT INTO user_profiles
         (user_id, gender, marital_status, phone, dob, join_dt,
          qualification, experience,
          current_address, permanent_address,
          father_name, mother_name, emergency_phone, department_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        uid,
        faker.helpers.arrayElement(["Male", "Female"]),
        faker.helpers.arrayElement(["Single", "Married"]),
        phone10(),
        faker.date.birthdate({ min: 25, max: 55, mode: "age" }),
        faker.date.past({ years: 10 }),
        faker.helpers.arrayElement(["B.Ed","M.Ed","B.Sc","M.Sc","B.A","M.A","Ph.D"]),
        `${faker.number.int({ min: 1, max: 20 })} years`,
        safeStr(faker.location.streetAddress(), 50),
        safeStr(faker.location.streetAddress(), 50),
        safeStr(faker.person.fullName({ sex: "male" }), 50),
        safeStr(faker.person.fullName({ sex: "female" }), 50),
        phone10(),
        faker.helpers.arrayElement(deptIds),
      ]
    );

    await client.query(
      `INSERT INTO class_teachers (teacher_id, class_name, section_name)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [uid,
       faker.helpers.arrayElement(classNames),
       faker.helpers.arrayElement(secNames)]
    );
  }

  console.log(`✅ Teachers seeded (${teacherIds.length})`);
  return teacherIds;
}

// ─── STUDENTS ─────────────────────────────────────────────────────────────────

async function seedStudents(count = 40) {
  console.log(`🌱 Seeding ${count} students...`);

  const classNames   = ["Class 1","Class 2","Class 3","Class 4","Class 5",
                        "Class 6","Class 7","Class 8","Class 9","Class 10"];
  const sectionNames = ["A","B","C","D"];

  for (let i = 0; i < count; i++) {
    const { rows, rowCount } = await client.query(
      `INSERT INTO users (name, email, role_id, is_active, is_email_verified, created_dt)
       VALUES ($1, $2, 3, true, false, now())
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      [safeStr(faker.person.fullName(), 100), faker.internet.email()]
    );
    if (rowCount === 0) continue;
    const uid = rows[0].id;

    await client.query(
      `INSERT INTO user_profiles
         (user_id, gender, phone, dob, admission_dt,
          class_name, section_name, roll,
          current_address, permanent_address,
          father_name, father_phone, mother_name, mother_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        uid,
        faker.helpers.arrayElement(["Male","Female"]),
        phone10(),
        faker.date.birthdate({ min: 6, max: 18, mode: "age" }),
        faker.date.past({ years: 5 }),
        faker.helpers.arrayElement(classNames),
        faker.helpers.arrayElement(sectionNames),
        faker.number.int({ min: 1, max: 60 }),
        safeStr(faker.location.streetAddress(), 50),
        safeStr(faker.location.streetAddress(), 50),
        safeStr(faker.person.fullName({ sex: "male" }), 50),
        phone10(),
        safeStr(faker.person.fullName({ sex: "female" }), 50),
        phone10(),
      ]
    );
  }

  console.log(`✅ Students seeded`);
}

// ─── LEAVE POLICY ASSIGNMENTS ─────────────────────────────────────────────────

// FIX: adminId is now included so the admin user also gets leave policies assigned,
// which resolves the 404 "Leave policies not found" error on /api/v1/leave/policies/me
async function seedLeavePolicyAssignments(adminId, teacherIds) {
  console.log("🌱 Seeding user_leave_policy...");
  const { rows } = await client.query(`SELECT id FROM leave_policies`);
  const policyIds = rows.map((r) => r.id);

  const allUserIds = [adminId, ...teacherIds];

  for (const uid of allUserIds) {
    const picked = faker.helpers.arrayElements(policyIds, 2);
    for (const pid of picked) {
      await client.query(
        `INSERT INTO user_leave_policy (user_id, leave_policy_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [uid, pid]
      );
    }
  }
  console.log("✅ Leave policy assignments seeded");
}

// ─── LEAVE REQUESTS ───────────────────────────────────────────────────────────

async function seedLeaveRequests(teacherIds, adminId) {
  console.log("🌱 Seeding user_leaves...");
  const { rows } = await client.query(`SELECT id FROM leave_policies`);
  const policyIds = rows.map((r) => r.id);

  for (let i = 0; i < 30; i++) {
    const uid    = faker.helpers.arrayElement(teacherIds);
    const pid    = faker.helpers.arrayElement(policyIds);
    const status = faker.helpers.arrayElement([1, 2, 3]); // 1=OnReview,2=Approved,3=Cancelled
    const from   = faker.date.recent({ days: 90 });
    const to     = new Date(from);
    to.setDate(to.getDate() + faker.number.int({ min: 1, max: 5 }));

    await client.query(
      `INSERT INTO user_leaves
         (user_id, leave_policy_id, from_dt, to_dt, note,
          submitted_dt, approved_dt, approver_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        uid, pid,
        from.toISOString().slice(0, 10),
        to.toISOString().slice(0, 10),
        safeStr(faker.lorem.sentence(), 100),
        from,
        status === 2 ? to : null,
        status === 2 ? adminId : null,
        status,
      ]
    );
  }
  console.log("✅ Leave requests seeded");
}

// ─── NOTICES ─────────────────────────────────────────────────────────────────

async function seedNotices(adminId) {
  console.log("🌱 Seeding notices...");

  for (let i = 0; i < 20; i++) {
    const recipientType   = faker.helpers.arrayElement(["EV", "SP"]);
    const recipientRoleId = recipientType === "SP"
      ? faker.helpers.arrayElement([2, 3]) : null;
    // status: 1=Draft,2=Approval Pending,4=Rejected,5=Approved,6=Deleted
    const status = faker.helpers.arrayElement([1, 2, 4, 5]);

    await client.query(
      `INSERT INTO notices
         (author_id, title, description, status,
          recipient_type, recipient_role_id, created_dt)
       VALUES ($1,$2,$3,$4,$5,$6,now())`,
      [
        adminId,
        safeStr(faker.lorem.sentence({ min: 3, max: 8 }), 100),
        safeStr(faker.lorem.paragraph(), 400),
        status,
        recipientType,
        recipientRoleId,
      ]
    );
  }
  console.log("✅ Notices seeded");
}

// ─── PERMISSIONS ──────────────────────────────────────────────────────────────

async function seedPermissions() {
  console.log("🌱 Seeding permissions...");

  // Admin (1) → all access controls
  const { rows: allAc } = await client.query(`SELECT id FROM access_controls`);
  for (const { id } of allAc) {
    await client.query(
      `INSERT INTO permissions (role_id, access_control_id)
       VALUES (1,$1) ON CONFLICT DO NOTHING`, [id]
    );
  }

  // Teacher (2) → scoped
  const { rows: teacherAc } = await client.query(`
    SELECT id FROM access_controls WHERE path IN (
      '/api/v1/dashboard', '/api/v1/leave/policies/me',
      '/api/v1/leave/request', '/api/v1/leave/request/:id',
      '/api/v1/notices', '/api/v1/notices/:id',
      '/api/v1/classes', '/api/v1/classes/:id',
      '/api/v1/sections', '/api/v1/sections/:id'
    )
  `);
  for (const { id } of teacherAc) {
    await client.query(
      `INSERT INTO permissions (role_id, access_control_id)
       VALUES (2,$1) ON CONFLICT DO NOTHING`, [id]
    );
  }

  // Student (3) → minimal
  const { rows: studentAc } = await client.query(`
    SELECT id FROM access_controls WHERE path IN (
      '/api/v1/dashboard', '/api/v1/leave/request',
      '/api/v1/notices', '/api/v1/notices/:id'
    )
  `);
  for (const { id } of studentAc) {
    await client.query(
      `INSERT INTO permissions (role_id, access_control_id)
       VALUES (3,$1) ON CONFLICT DO NOTHING`, [id]
    );
  }

  console.log("✅ Permissions seeded");
}

// ─── RUNNER ───────────────────────────────────────────────────────────────────

async function run() {
  try {
    await createDatabase();
    await client.connect();
    await client.query("BEGIN");

    await createSchema();          // 14 tables + 4 stored functions

    await seedRoles();             // Admin, Teacher, Student
    await seedLeaveStatus();       // On Review, Approved, Cancelled
    await seedNoticeStatus();      // Draft … Deleted
    await seedAccessControls();    // all 100+ rows
    await seedBase();              // classes, sections, departments, policies, notice_recipient_types

    const adminId    = await seedAdmin();
    const teacherIds = await seedTeachers(15);
    await seedStudents(40);

    // FIX: pass adminId so admin is included in leave policy assignments
    await seedLeavePolicyAssignments(adminId, teacherIds);
    await seedLeaveRequests(teacherIds, adminId);
    await seedNotices(adminId);
    await seedPermissions();

    await client.query("COMMIT");
    console.log("\n🎉 FULL DB READY\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ ERROR:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();