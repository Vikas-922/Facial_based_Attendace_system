from flask import Flask, request, jsonify, send_from_directory
import pymongo
import datetime
import cv2
import face_recognition
import numpy as np
import pickle
import base64
import os
from flask_cors import CORS
import traceback
from bson import ObjectId
import secrets
import string
import re
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder="frontend/build", static_url_path="/")
CORS(app)

db_user = os.getenv("DB_USER")
db_password = os.getenv("DB_PASSWORD")

# Connect to MongoDB
connection_string = f"mongodb+srv://{db_user}:{db_password}@cluster0.zaohd.mongodb.net/Student_attendance?retryWrites=true&w=majority"
db_client = pymongo.MongoClient(connection_string)
db = db_client["Student_attendance"]
students_collection = db["students"]
teachers_collection = db["teachers"]
admin_collection = db["admins"]
attendance_collection = db["attendance"]
subjects_collection = db["subjects"]

# Helper function to convert base64 image to numpy array
def base64_to_image(base64_string):
    try:
        # Remove metadata from base64 string if present
        base64_string = base64_string.split(",")[-1]  
        image_data = base64.b64decode(base64_string)
        np_arr = np.frombuffer(image_data, np.uint8)
        image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise ValueError("Decoded image is None")
        
        return image
    except Exception as e:
        raise ValueError(f"Error converting Base64 to image: {str(e)}")

# Generate IDs
def generate_student_id():
    # Get the latest student ID
    latest_student = students_collection.find_one(sort=[("student_id", -1)])
    if latest_student and "student_id" in latest_student:
        latest_id = latest_student["student_id"]
        if latest_id.startswith("S"):
            num = int(latest_id[1:]) + 1
            return f"S{num:05d}"
    return "S00001"  # First student

def generate_teacher_id():
    # Get the latest teacher ID
    latest_teacher = teachers_collection.find_one(sort=[("teacher_id", -1)])
    if latest_teacher and "teacher_id" in latest_teacher:
        latest_id = latest_teacher["teacher_id"]
        if latest_id.startswith("T"):
            num = int(latest_id[1:]) + 1
            return f"T{num:03d}"
    return "T001"  # First teacher

def generate_subject_id():
    # Get the latest subject ID
    latest_subject = subjects_collection.find_one(sort=[("subject_id", -1)])
    if latest_subject and "subject_id" in latest_subject:
        latest_id = latest_subject["subject_id"]
        if latest_id.startswith("B"):
            num = int(latest_id[1:]) + 1
            return f"B{num:03d}"
    return "B001"  # First subject

def generate_password(length=8):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

# Authentication Routes
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    user_id = data.get("user_id")
    password = data.get("password")
    
    if not user_id or not password:
        return jsonify({"error": "User ID and password are required"}), 400
    
    if user_id.startswith("S"):
        user = students_collection.find_one({"student_id": user_id})
        if user and user.get("password") == password:
            return jsonify({
                "user_type": "student",
                "user_id": user["student_id"],
                "name": user["name"],
                "course": user["course"],
                "class_year": user["class_year"],
                "division": user["division"]
            })
    elif user_id.startswith("T"):
        user = teachers_collection.find_one({"teacher_id": user_id})
        if user and user.get("password") == password:
            return jsonify({
                "user_type": "teacher",
                "user_id": user["teacher_id"],
                "name": user["name"],
                "subjects": user.get("subjects", [])
            })
    elif user_id == "admin":
        user = admin_collection.find_one({"username": user_id})
        if user and user.get("password") == password:
            return jsonify({
                "user_type": "admin",
                "name": "Administrator"
            })
    
    return jsonify({"error": "Invalid credentials"}), 401

# Admin Routes
@app.route("/api/teachers", methods=["GET"])
def get_teachers():
    teachers = list(teachers_collection.find({}, {"_id": 0, "password": 0}))
    return jsonify({"teachers": teachers})

@app.route("/api/teachers", methods=["POST"])
def add_teacher():
    data = request.json
    name = data.get("name")
    
    if not name:
        return jsonify({"error": "Teacher name is required"}), 400
    
    teacher_id = generate_teacher_id()
    password = generate_password()
    
    teacher_data = {
        "teacher_id": teacher_id,
        "name": name,
        "password": password,
        "subjects": [],
        "registered_at": datetime.datetime.now().isoformat()
    }
    
    result = teachers_collection.insert_one(teacher_data)
    # Add _id to the response by converting it to a string
    teacher_data["_id"] = str(result.inserted_id)
    
    # Return without password in response
    teacher_data.pop("password")
    return jsonify({
        "message": "Teacher added successfully", 
        "teacher": teacher_data,
        "initial_password": password
    })

@app.route("/api/teachers/<teacher_id>", methods=["DELETE"])
def delete_teacher(teacher_id):
    result = teachers_collection.delete_one({"teacher_id": teacher_id})
    if result.deleted_count == 0:
        return jsonify({"error": "Teacher not found"}), 404
    
    # Also delete any subject assignments
    subjects_collection.update_many(
        {"teacher_id": teacher_id},
        {"$set": {"teacher_id": None}}
    )
    
    return jsonify({"message": "Teacher deleted successfully"})

@app.route("/api/subjects", methods=["GET"])
def get_subjects():
    subjects = list(subjects_collection.find({}, {"_id": 0}))
    return jsonify({"subjects": subjects})

@app.route("/api/subjects", methods=["POST"])
def add_subject():
    data = request.json
    subject_name = data.get("name")
    course = data.get("course")
    class_year = data.get("class_year")

    subject_id = generate_subject_id()
    
    if not subject_name or not course or not class_year:
        return jsonify({"error": "Subject name, course, and class year are required"}), 400
    
    subject_data = {
        "subject_id": subject_id,
        "name": subject_name,
        "course": course,
        "class_year": class_year,
        "teacher_id": None
    }
    
    result = subjects_collection.insert_one(subject_data)
    subject_data["_id"] = str(result.inserted_id)  # Convert ObjectId to string
    
    return jsonify({"message": "Subject added successfully", "subject": subject_data})

@app.route("/api/subjects/assign", methods=["POST"])
def assign_subject():
    data = request.json
    subject_id = data.get("subject_id")
    teacher_id = data.get("teacher_id")
    
    # if not ObjectId.is_valid(subject_id):
    #     return jsonify({"error": "Invalid subject ID"}), 400
    if not re.match(r"^B\d+$", subject_id):
        return jsonify({"error": "Invalid subject ID. It must start with 'B' followed by digits."}), 400
    
    subject = subjects_collection.find_one({"subject_id": subject_id})
    if not subject:
        return jsonify({"error": "Subject not found"}), 404
    
    if teacher_id:
        teacher = teachers_collection.find_one({"teacher_id": teacher_id})
        if not teacher:
            return jsonify({"error": "Teacher not found"}), 404
    
    # Update subject with teacher
    subjects_collection.update_one(
        {"subject_id": subject_id},
        {"$set": {"teacher_id": teacher_id}}
    )
    
    # Update teacher's subjects list
    if teacher_id:
        teachers_collection.update_one(
            {"teacher_id": teacher_id},
            {"$addToSet": {"subjects": {
                "subject_id": subject_id,
                "name": subject["name"],
                "course": subject["course"],
                "class_year": subject["class_year"]
            }}}
        )
    
    return jsonify({"message": "Subject assigned successfully"})

# Teacher Routes
@app.route("/api/students", methods=["GET"])
def get_students():
    course = request.args.get("course")
    class_year = request.args.get("class_year")
    division = request.args.get("division")
    
    query = {}
    if course:
        query["course"] = course
    if class_year:
        query["class_year"] = class_year
    if division:
        query["division"] = division
    
    students = list(students_collection.find(query, {"_id": 0, "password": 0, "face_encoding": 0}))
    return jsonify({"students": students})


# GET student details by student_id
@app.route("/api/students/<studentId>", methods=["GET"])
def get_student_details(studentId):
    student = students_collection.find_one({"student_id": studentId}, {"_id": 0, "password": 0, "face_encoding": 0, "registered_at":0})
    if not student:
        return jsonify({"error": "Student not found"}), 404
    # student["_id"] = str(student["_id"])

    return jsonify({"student": student})


@app.route("/api/students", methods=["POST"])
def register_student():
    data = request.json
    name = data.get("name")
    age = data.get("age")
    dob = data.get("dob")
    course = data.get("course")
    class_year = data.get("class_year")
    division = data.get("division")
    
    if not all([name, age, dob, course, class_year, division]):
        return jsonify({"error": "All fields are required"}), 400
    
    student_id = generate_student_id()
    password = generate_password()
    
    student_data = {
        "student_id": student_id,
        "name": name,
        "age": age,
        "dob": dob,
        "course": course,
        "class_year": class_year,
        "division": division,
        "password": password,
        "face_registered": False,
        "registered_at": datetime.datetime.now().isoformat()
    }
    
    results = students_collection.insert_one(student_data)
    student_data["_id"] = str(results.inserted_id)  # Convert ObjectId to string
    
    # Return without sensitive data
    student_data.pop("password")
    return jsonify({
        "message": "Student registered successfully", 
        "student": student_data,
        "initial_password": password
    })

# POST register student's face (face registration)
@app.route("/api/students/<student_id>/face", methods=["POST"])
def register_face(student_id):
    data = request.json
    image_base64 = data.get("image")
    
    if not image_base64:
        return jsonify({"error": "Face image is required"}), 400
    
    student = students_collection.find_one({"student_id": student_id})
    if not student:
        return jsonify({"error": "Student not found"}), 404
    
    try:
        image_np = base64_to_image(image_base64)
        rgb_frame = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
        face_locations = face_recognition.face_locations(rgb_frame)
        
        if not face_locations:
            return jsonify({"error": "No face detected"}), 400
        
        face_encoding = face_recognition.face_encodings(rgb_frame, face_locations)[0]
        
        students_collection.update_one(
            {"student_id": student_id},
            {"$set": {
                "face_encoding": pickle.dumps(face_encoding),
                "face_registered": True
            }}
        )
        
        return jsonify({"message": "Face registered successfully"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    

@app.route("/api/attendance/view", methods=["GET"])
def view_attendance():
    # Required query parameters
    course = request.args.get("course")
    class_year = request.args.get("class_year")
    division = request.args.get("division")
    subject_id = request.args.get("subject_id")
    date_str = request.args.get("date")

    # Validate required parameters
    if not all([course, class_year, division, subject_id, date_str]):
        return jsonify({"error": "Course, Class Year, Division, Subject ID, and Date are required"}), 400

    # Parse and normalize the date
    try:
        attendance_date = datetime.datetime.strptime(date_str, "%Y-%m-%d")
        attendance_date = attendance_date.replace(hour=0, minute=0, second=0, microsecond=0)
    except ValueError:
        return jsonify({"error": "Invalid date format, use YYYY-MM-DD"}), 400

    # Fetch students matching the given filters
    students = list(students_collection.find(
        {"course": course, "class_year": class_year, "division": division},
        {"_id": 0, "password": 0, "face_encoding": 0}
    ))

    # For each student, check if an attendance record exists for the subject on the specified date
    for student in students:
        attendance = attendance_collection.find_one({
            "student_id": student["student_id"],
            "subject_id": subject_id,
            "date": attendance_date
        })
        if attendance:
            student["status"] = attendance["status"]
        else:
            student["status"] = "absent"  # Default status if no attendance record exists

    return jsonify({"students": students})



@app.route("/api/attendance/status", methods=["GET"])
def check_attendance_status():
    subject_id = request.args.get("subject_id")
    if not subject_id:
        return jsonify({"error": "Subject ID is required"}), 400
    
    # Validate subject_id format
    if not re.match(r"^B\d+$", subject_id):
        return jsonify({"error": "Invalid subject ID"}), 400
    
    subject = subjects_collection.find_one({"subject_id": subject_id})
    if not subject:
        return jsonify({"error": "Subject not found"}), 404
    
    enabled = subject.get("attendance_enabled", False)
    return jsonify({"enabled": enabled})


@app.route("/api/attendance/enable", methods=["POST"])
def enable_attendance():
    data = request.json
    subject_id = data.get("subject_id")
    enabled = data.get("enabled", True)
    
    if not subject_id:
        return jsonify({"error": "Subject ID is required"}), 400
    
    # Validate subject_id format
    if not re.match(r"^B\d+$", subject_id):
        return jsonify({"error": "Invalid subject ID"}), 400
    
    subject = subjects_collection.find_one({"subject_id": subject_id})
    if not subject:
        return jsonify({"error": "Subject not found"}), 404
    
    # Update subject's attendance_enabled status
    subjects_collection.update_one(
        {"subject_id": subject_id},
        {"$set": {"attendance_enabled": enabled}}
    )
    
    return jsonify({"message": f"Attendance {'enabled' if enabled else 'disabled'} for subject"})


@app.route("/api/teachers/subjects", methods=["GET"])
def get_teacher_subjects():
    teacher_id = request.args.get("teacherId")
    if not teacher_id:
        return jsonify({"error": "Teacher ID is required"}), 400

    subjects = list(subjects_collection.find({"teacher_id": teacher_id}, {"_id": 0}))
    # print(subjects)
    return jsonify({"subjects": subjects})


# GET subjects filtered by course and class_year (from query parameters)
@app.route("/api/student/subjects", methods=["GET"])
def get_student_subjects():
    course = request.args.get("course")
    class_year = request.args.get("class_year")
    if not course or not class_year:
        return jsonify({"error": "course and class_year query parameters are required"}), 400
    subjects_cursor = subjects_collection.find({"course": course, "class_year": class_year}, {"_id": 0})
    subjects = list(subjects_cursor)
    return jsonify({"subjects": subjects})


# Manual attandance marking in batch
@app.route("/api/attendance/mark_batch", methods=["POST"])
def mark_batch_attendance():
    data = request.json
    attendances = data.get("attendances")  # Array of objects: [{"student_id": "S00003", "status": "present"}, ...]
    subject_id = data.get("subject_id")
    marked_by = data.get("marked_by")  # Teacher marking the attendance
    date_str = data.get("date", datetime.datetime.now().strftime("%Y-%m-%d"))

    if not subject_id:
        return jsonify({"error": "Subject ID is required"}), 400
    if not attendances or not isinstance(attendances, list):
        return jsonify({"error": "Attendances must be provided as a list"}), 400

    # Validate subject_id format and existence
    if not re.match(r"^B\d+$", subject_id):
        return jsonify({"error": "Invalid subject ID. It must start with 'B' followed by digits."}), 400
    subject = subjects_collection.find_one({"subject_id": subject_id})
    if not subject:
        return jsonify({"error": "Subject not found"}), 404

    # Parse and normalize the date
    try:
        attendance_date = datetime.datetime.strptime(date_str, "%Y-%m-%d")
        attendance_date = attendance_date.replace(hour=0, minute=0, second=0, microsecond=0)
    except ValueError:
        return jsonify({"error": "Invalid date format, use YYYY-MM-DD"}), 400

    results = []
    for record in attendances:
        student_id = record.get("student_id")
        status = record.get("status")
        if not student_id or not status:
            results.append({"student_id": student_id, "error": "Student ID and status required"})
            continue
        if status not in ["present", "absent"]:
            results.append({"student_id": student_id, "error": "Status must be 'present' or 'absent'"})
            continue
        
        # Find the student record
        student = students_collection.find_one({"student_id": student_id})
        if not student:
            results.append({"student_id": student_id, "error": "Student not found"})
            continue

        # Check if attendance record already exists for this student, subject, and date
        existing = attendance_collection.find_one({
            "student_id": student_id,
            "subject_id": subject_id,
            "date": attendance_date
        })

        if existing:
            # Update the existing record
            attendance_collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "status": status,
                    "updated_at": datetime.datetime.now().isoformat(),
                    "updated_by": marked_by
                }}
            )
            results.append({"student_id": student_id, "message": "Attendance updated successfully"})
        else:
            # Create new attendance record
            attendance_data = {
                "student_id": student_id,
                "student_name": student["name"],
                "subject_id": subject_id,
                "subject_name": subject["name"],
                "course": student["course"],
                "class_year": student["class_year"],
                "division": student["division"],
                "status": status,
                "date": attendance_date,
                "created_at": datetime.datetime.now().isoformat(),
                "marked_by": marked_by
            }
            attendance_collection.insert_one(attendance_data)
            results.append({"student_id": student_id, "message": "Attendance marked successfully"})

    return jsonify({"results": results})

# POST mark attendance (or update if already exists) with facial verification
@app.route("/api/attendance/mark", methods=["POST"])
def mark_attendance():
    data = request.json
    student_id = data.get("student_id")
    subject_id = data.get("subject_id")
    status = data.get("status")  # "present" or "absent"
    image_base64 = data.get("image")  # Optional - for face recognition
    date = data.get("date", datetime.datetime.now().strftime("%Y-%m-%d"))
    
    if not student_id or not subject_id or not status:
        return jsonify({"error": "Student ID, subject ID, and status are required"}), 400
    
    if status not in ["present", "absent"]:
        return jsonify({"error": "Status must be 'present' or 'absent'"}), 400
    
    student = students_collection.find_one({"student_id": student_id})
    if not student:
        return jsonify({"error": "Student not found"}), 404
    
    # if not ObjectId.is_valid(subject_id):
    #     return jsonify({"error": "Invalid subject ID"}), 400
    if not re.match(r"^B\d+$", subject_id):
        return jsonify({"error": "Invalid subject ID. It must start with 'B' followed by digits."}), 400
    
    subject = subjects_collection.find_one({"subject_id": subject_id})
    if not subject:
        return jsonify({"error": "Subject not found"}), 404
    
    # Check if attendance is enabled for the subject (if student is marking)
    if not data.get("teacher_marked", False):
        if not subject.get("attendance_enabled", False):
            return jsonify({"error": "Attendance marking is not enabled for this subject"}), 403

        # Enforce that an image is provided for face verification
        if not image_base64:
            return jsonify({"error": "Image is required for facial verification"}), 400

    # If image provided and student marking attendance, verify face
    if image_base64 and not data.get("teacher_marked", False):
        try:
            if not student.get("face_registered", False):
                return jsonify({"error": "Student face not registered"}), 400
            
            image_np = base64_to_image(image_base64)
            rgb_frame = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
            face_locations = face_recognition.face_locations(rgb_frame)
            
            if not face_locations:
                return jsonify({"error": "No face detected"}), 400
            
            face_encoding = face_recognition.face_encodings(rgb_frame, face_locations)[0]
            stored_encoding = pickle.loads(student["face_encoding"])
            
            matches = face_recognition.compare_faces([stored_encoding], face_encoding, tolerance=0.5)
            
            if not matches[0]:
                return jsonify({"error": "Face does not match registered face"}), 403
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": f"Face verification error: {str(e)}"}), 500
    
    # Parse date string to datetime
    try:
        attendance_date = datetime.datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format, use YYYY-MM-DD"}), 400
    
    # Set to midnight for consistent querying
    attendance_date = attendance_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Check if attendance already marked
    existing = attendance_collection.find_one({
        "student_id": student_id,
        "subject_id": subject_id,
        "date": attendance_date
    })
    
    if existing:
        # Update existing attendance
        attendance_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "status": status,
                "updated_at": datetime.datetime.now().isoformat(),
                "updated_by": data.get("marked_by", student_id)
            }}
        )
        return jsonify({"message": "Attendance updated successfully"})
    else:
        # Create new attendance record
        attendance_data = {
            "student_id": student_id,
            "student_name": student["name"],
            "subject_id": subject_id,
            "subject_name": subject["name"],
            "course": student["course"],
            "class_year": student["class_year"],
            "division": student["division"],
            "status": status,
            "date": attendance_date,
            "created_at": datetime.datetime.now().isoformat(),
            "marked_by": data.get("marked_by", student_id)
        }
        
        attendance_collection.insert_one(attendance_data)
        return jsonify({"message": "Attendance marked successfully"})



@app.route('/api/mark_absent', methods=['POST'])
def mark_all_absent():
    data = request.json
    subject_id = data.get("subject_id")
    date = data.get("date", datetime.datetime.now().strftime("%Y-%m-%d"))
    teacher_id = data.get("teacher_id")

    # Validate required fields
    if not subject_id or not teacher_id:
        return jsonify({"error": "subject_id and teacher_id are required"}), 400

    # Check if attendance for this subject on the given date is already recorded
    existing_record = attendance_collection.find_one({"date": date, "subject_id": subject_id})
    if existing_record:
        return jsonify({"message": "Attendance has already been marked for this subject today."}), 400

    # Get subject details
    subject = subjects_collection.find_one({"subject_id": subject_id})
    if not subject:
        return jsonify({"error": "Invalid subject_id"}), 400

    # Get all students enrolled in the subject
    students = students_collection.find({"course": subject["course"]})

    absent_records = []
    for student in students:
        absent_records.append({
            "student_id": student["student_id"],
            "student_name": student["name"],
            "subject_id": subject_id,
            "subject_name": subject["name"],
            "course": student["course"],
            "class_year": student["class_year"],
            "division": student["division"],
            "status": "absent",
            "date": date,
            "created_at": datetime.datetime.now(),
            "marked_by": teacher_id
        })

    # Insert attendance records into MongoDB
    if absent_records:
        attendance_collection.insert_many(absent_records)

    return jsonify({"message": f"All {len(absent_records)} students marked absent for {date} in {subject['name']}."}), 200


# batch attendance allows facial
@app.route("/api/attendance/batch_facial", methods=["POST"])
def mark_attendance_facial_batch():
    data = request.json
    images = data.get("images")
    subject_id = data.get("subject_id")
    date = data.get("date", datetime.datetime.now().strftime("%Y-%m-%d"))
    teacher_id = data.get("teacher_id")
    
    if not images or not subject_id or not teacher_id:
        return jsonify({"error": "Images, subject ID, and teacher ID are required"}), 400
    
    if not re.match(r"^B\d+$", subject_id):
        return jsonify({"error": "Invalid subject ID"}), 400
    
    subject = subjects_collection.find_one({"subject_id": subject_id})
    if not subject:
        return jsonify({"error": "Subject not found"}), 404
    
    # Parse date string to datetime
    try:
        attendance_date = datetime.datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format, use YYYY-MM-DD"}), 400
    
    # Set to midnight for consistent querying
    attendance_date = attendance_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get all students for this subject's course and class
    students = list(students_collection.find({
        "course": subject["course"],
        "class_year": subject["class_year"],
        "face_registered": True
    }))
    
    if not students:
        return jsonify({"error": "No registered students found for this subject"}), 404
    
    # Prepare known face encodings
    known_encodings = []
    student_ids = []
    
    for student in students:
        if student.get("face_encoding"):
            known_encodings.append(pickle.loads(student["face_encoding"]))
            student_ids.append(student["student_id"])
    
    if not known_encodings:
        return jsonify({"error": "No student face encodings found"}), 404
    
    # Process each image
    results = []
    recognized_students = set()
    
    for image_base64 in images:
        try:
            image_np = base64_to_image(image_base64)
            rgb_frame = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
            face_locations = face_recognition.face_locations(rgb_frame)
            face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
            
            if not face_encodings:
                continue
            
            for encoding in face_encodings:
                matches = face_recognition.compare_faces(known_encodings, encoding, tolerance=0.5)
                
                if True in matches:
                    match_index = matches.index(True)
                    student_id = student_ids[match_index]
                    
                    if student_id in recognized_students:
                        continue
                    
                    recognized_students.add(student_id)
                    
                    # Get student details
                    student = next((s for s in students if s["student_id"] == student_id), None)
                    
                    # Mark attendance
                    existing = attendance_collection.find_one({
                        "student_id": student_id,
                        "subject_id": subject_id,
                        "date": attendance_date
                    })
                    
                    if existing:
                        attendance_collection.update_one(
                            {"_id": existing["_id"]},
                            {"$set": {
                                "status": "present",
                                "updated_at": datetime.datetime.now(),
                                "updated_by": teacher_id
                            }}
                        )
                    else:
                        attendance_data = {
                            "student_id": student_id,
                            "student_name": student["name"],
                            "subject_id": subject_id,
                            "subject_name": subject["name"],
                            "course": student["course"],
                            "class_year": student["class_year"],
                            "division": student["division"],
                            "status": "present",
                            "date": attendance_date,
                            "created_at": datetime.datetime.now(),
                            "marked_by": teacher_id
                        }
                        
                        attendance_collection.insert_one(attendance_data)
                    
                    results.append({
                        "student_id": student_id,
                        "name": student["name"],
                        "status": "present"
                    })
        except Exception as e:
            traceback.print_exc()
            continue

    # Get current time in hh:mm format
    current_time = datetime.datetime.now().strftime("%M:%S")
    return jsonify({
        "message": f"{current_time} : +{len(recognized_students)} students marked present",
        "results": results
    })

@app.route("/api/attendance", methods=["GET"])
def get_attendance():
    subject_id = request.args.get("subject_id")
    student_id = request.args.get("student_id")
    date = request.args.get("date")
    
    query = {}
    
    if subject_id:
        if re.match(r"^B\d+$", subject_id):
            query["subject_id"] = subject_id
        else:
            return jsonify({"error": "Invalid subject ID"}), 400
    
    if student_id:
        query["student_id"] = student_id
    
    if date:
        try:
            attendance_date = datetime.datetime.strptime(date, "%Y-%m-%d")
            attendance_date = attendance_date.replace(hour=0, minute=0, second=0, microsecond=0)
            query["date"] = attendance_date
        except ValueError:
            return jsonify({"error": "Invalid date format, use YYYY-MM-DD"}), 400
    
    attendance_records = list(attendance_collection.find(query, {"_id": 0, "class_year": 0, "course": 0 , "created_at":0, "student_name": 0   }))
    
    # Convert datetime objects to strings only if they are not already strings
    for record in attendance_records:
        if "date" in record and isinstance(record["date"], datetime.datetime):
            record["date"] = record["date"].strftime("%Y-%m-%d")

        if "created_at" in record and isinstance(record["created_at"], datetime.datetime):
            record["created_at"] = record["created_at"].strftime("%Y-%m-%d %H:%M:%S")
            
        if "updated_at" in record and isinstance(record["updated_at"], datetime.datetime):
            record["updated_at"] = record["updated_at"].strftime("%Y-%m-%d %H:%M:%S")
    
    return jsonify({"attendance": attendance_records})


# Setup initial admin if not exists
# @app.before_request
def initialize_admin():
    if admin_collection.count_documents({}) == 0:
        admin_collection.insert_one({
            "username": "admin",
            "password": "admin123",  # Change this in production
            "created_at": datetime.datetime.now()
        })
        print("Admin user created with username 'admin' and password 'admin123'")

# initialize_admin()

# Serve React Frontend
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)