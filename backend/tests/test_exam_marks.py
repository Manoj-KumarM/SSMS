"""
Test suite for Exam and Marks Management System
Tests: Admin exam CRUD, Teacher marks entry, Student marks view, CSV upload/download, PDF report
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@college.edu"
ADMIN_PASSWORD = "admin123"
TEACHER_EMAIL = "john@college.edu"
TEACHER_PASSWORD = "teacher123"
STUDENT_EMAIL = "alice@college.edu"
STUDENT_PASSWORD = "student123"


class TestAuthAndSetup:
    """Authentication tests and setup verification"""
    
    def test_admin_login(self):
        """Test admin login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"Admin login successful: {data['user']['email']}")
    
    def test_teacher_login(self):
        """Test teacher login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "teacher"
        print(f"Teacher login successful: {data['user']['email']}")
    
    def test_student_login(self):
        """Test student login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STUDENT_EMAIL,
            "password": STUDENT_PASSWORD
        })
        assert response.status_code == 200, f"Student login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "student"
        print(f"Student login successful: {data['user']['email']}")


@pytest.fixture
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Admin login failed")
    return response.json()["access_token"]


@pytest.fixture
def teacher_token():
    """Get teacher auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_EMAIL,
        "password": TEACHER_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Teacher login failed")
    return response.json()["access_token"]


@pytest.fixture
def student_token():
    """Get student auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": STUDENT_EMAIL,
        "password": STUDENT_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Student login failed")
    return response.json()["access_token"]


class TestAdminExamManagement:
    """Admin exam CRUD operations"""
    
    def test_get_all_exams(self, admin_token):
        """Admin can view all exams"""
        response = requests.get(
            f"{BASE_URL}/api/admin/exams",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get exams: {response.text}"
        exams = response.json()
        assert isinstance(exams, list)
        print(f"Found {len(exams)} exams")
        for exam in exams:
            print(f"  - {exam.get('exam_name')} ({exam.get('exam_type')}) - {exam.get('branch')} SEM{exam.get('semester')}")
    
    def test_get_subjects(self, admin_token):
        """Get subjects for exam creation"""
        response = requests.get(
            f"{BASE_URL}/api/admin/subjects",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        subjects = response.json()
        print(f"Found {len(subjects)} subjects")
        return subjects
    
    def test_create_exam(self, admin_token):
        """Admin can create an exam"""
        # First get subjects
        subjects_resp = requests.get(
            f"{BASE_URL}/api/admin/subjects",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        subjects = subjects_resp.json()
        
        # Filter subjects for CSE SEM5 A
        cse5a_subjects = [s for s in subjects if s.get('branch') == 'CSE' and s.get('semester') == 5 and s.get('section') == 'A']
        
        if not cse5a_subjects:
            pytest.skip("No subjects found for CSE SEM5 A")
        
        subject_ids = [s['id'] for s in cse5a_subjects[:2]]  # Take first 2 subjects
        
        exam_data = {
            "exam_name": "TEST_Unit_Test_Jan_2026",
            "exam_type": "Unit Test",
            "date": "2026-01-20",
            "branch": "CSE",
            "semester": 5,
            "section": "A",
            "subject_ids": subject_ids,
            "max_marks": 50
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/exams",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=exam_data
        )
        assert response.status_code == 200, f"Failed to create exam: {response.text}"
        data = response.json()
        assert "exam" in data
        assert data["exam"]["exam_name"] == "TEST_Unit_Test_Jan_2026"
        assert data["exam"]["max_marks"] == 50
        print(f"Created exam: {data['exam']['exam_name']} with ID: {data['exam']['id']}")
        return data["exam"]["id"]
    
    def test_update_exam(self, admin_token):
        """Admin can update an exam"""
        # Get exams first
        exams_resp = requests.get(
            f"{BASE_URL}/api/admin/exams",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        exams = exams_resp.json()
        test_exam = next((e for e in exams if e.get('exam_name', '').startswith('TEST_')), None)
        
        if not test_exam:
            pytest.skip("No test exam found to update")
        
        update_data = {
            "exam_name": "TEST_Unit_Test_Jan_2026_Updated",
            "max_marks": 60
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/exams/{test_exam['id']}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=update_data
        )
        assert response.status_code == 200, f"Failed to update exam: {response.text}"
        print(f"Updated exam: {test_exam['id']}")
    
    def test_get_exam_analytics(self, admin_token):
        """Admin can view exam analytics"""
        # Get exams first
        exams_resp = requests.get(
            f"{BASE_URL}/api/admin/exams",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        exams = exams_resp.json()
        
        if not exams:
            pytest.skip("No exams found")
        
        # Use first exam with marks
        exam = exams[0]
        
        response = requests.get(
            f"{BASE_URL}/api/admin/exam-analytics?exam_id={exam['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get analytics: {response.text}"
        data = response.json()
        assert "exam" in data
        assert "subject_stats" in data
        assert "overall" in data
        print(f"Analytics for {exam['exam_name']}:")
        print(f"  Total students: {data['overall'].get('total_students', 0)}")
        print(f"  Pass rate: {data['overall'].get('pass_percentage', 0)}%")
    
    def test_get_exam_marks(self, admin_token):
        """Admin can view exam marks"""
        exams_resp = requests.get(
            f"{BASE_URL}/api/admin/exams",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        exams = exams_resp.json()
        
        if not exams:
            pytest.skip("No exams found")
        
        exam = exams[0]
        
        response = requests.get(
            f"{BASE_URL}/api/admin/exam-marks?exam_id={exam['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get marks: {response.text}"
        marks = response.json()
        assert isinstance(marks, list)
        print(f"Found {len(marks)} marks entries for exam {exam['exam_name']}")
    
    def test_download_exam_marks_csv(self, admin_token):
        """Admin can download exam marks as CSV"""
        exams_resp = requests.get(
            f"{BASE_URL}/api/admin/exams",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        exams = exams_resp.json()
        
        if not exams:
            pytest.skip("No exams found")
        
        exam = exams[0]
        
        response = requests.get(
            f"{BASE_URL}/api/admin/exam-marks/csv?exam_id={exam['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to download CSV: {response.text}"
        assert 'text/csv' in response.headers.get('content-type', '')
        print(f"CSV download successful for exam {exam['exam_name']}")


class TestTeacherMarksManagement:
    """Teacher marks entry and management"""
    
    def test_get_teacher_exams(self, teacher_token):
        """Teacher can view assigned exams"""
        response = requests.get(
            f"{BASE_URL}/api/teacher/exams",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Failed to get teacher exams: {response.text}"
        exams = response.json()
        assert isinstance(exams, list)
        print(f"Teacher has {len(exams)} assigned exams")
        for exam in exams:
            print(f"  - {exam.get('exam_name')} with subjects: {[s.get('subject_name') for s in exam.get('subjects', [])]}")
        return exams
    
    def test_get_students_for_marks_entry(self, teacher_token):
        """Teacher can get student list for marks entry"""
        # Get teacher's exams first
        exams_resp = requests.get(
            f"{BASE_URL}/api/teacher/exams",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        exams = exams_resp.json()
        
        if not exams:
            pytest.skip("No exams assigned to teacher")
        
        exam = exams[0]
        subjects = exam.get('subjects', [])
        
        if not subjects:
            pytest.skip("No subjects in exam")
        
        subject_id = subjects[0]['id']
        
        response = requests.get(
            f"{BASE_URL}/api/teacher/exam-marks/{exam['id']}/{subject_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Failed to get students: {response.text}"
        data = response.json()
        assert "students" in data
        print(f"Found {len(data['students'])} students for marks entry")
        return data
    
    def test_bulk_marks_entry(self, teacher_token):
        """Teacher can save bulk marks"""
        # Get teacher's exams
        exams_resp = requests.get(
            f"{BASE_URL}/api/teacher/exams",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        exams = exams_resp.json()
        
        if not exams:
            pytest.skip("No exams assigned to teacher")
        
        exam = exams[0]
        subjects = exam.get('subjects', [])
        
        if not subjects:
            pytest.skip("No subjects in exam")
        
        subject_id = subjects[0]['id']
        
        # Get students
        students_resp = requests.get(
            f"{BASE_URL}/api/teacher/exam-marks/{exam['id']}/{subject_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        students_data = students_resp.json()
        students = students_data.get('students', [])
        
        if not students:
            pytest.skip("No students found")
        
        # Create bulk marks entries
        entries = []
        for i, student in enumerate(students[:3]):  # Test with first 3 students
            entries.append({
                "student_id": student['student_id'],
                "marks_obtained": min(45 + i * 5, exam.get('max_marks', 100)),  # 45, 50, 55
                "remarks": f"Test marks entry {i+1}"
            })
        
        bulk_data = {
            "exam_id": exam['id'],
            "subject_id": subject_id,
            "entries": entries
        }
        
        response = requests.post(
            f"{BASE_URL}/api/teacher/exam-marks/bulk",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json=bulk_data
        )
        assert response.status_code == 200, f"Failed to save bulk marks: {response.text}"
        data = response.json()
        print(f"Bulk marks saved: {data.get('message')}")
    
    def test_marks_validation_exceeds_max(self, teacher_token):
        """Marks cannot exceed max marks"""
        exams_resp = requests.get(
            f"{BASE_URL}/api/teacher/exams",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        exams = exams_resp.json()
        
        if not exams:
            pytest.skip("No exams assigned to teacher")
        
        exam = exams[0]
        subjects = exam.get('subjects', [])
        
        if not subjects:
            pytest.skip("No subjects in exam")
        
        subject_id = subjects[0]['id']
        
        # Get students
        students_resp = requests.get(
            f"{BASE_URL}/api/teacher/exam-marks/{exam['id']}/{subject_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        students_data = students_resp.json()
        students = students_data.get('students', [])
        
        if not students:
            pytest.skip("No students found")
        
        # Try to enter marks exceeding max
        invalid_entry = {
            "exam_id": exam['id'],
            "subject_id": subject_id,
            "student_id": students[0]['student_id'],
            "marks_obtained": exam.get('max_marks', 100) + 50,  # Exceeds max
            "remarks": "Invalid marks test"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/teacher/exam-marks",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json=invalid_entry
        )
        assert response.status_code == 400, f"Should reject marks exceeding max: {response.text}"
        print("Validation working: Marks exceeding max rejected")
    
    def test_marks_validation_negative(self, teacher_token):
        """Marks cannot be negative"""
        exams_resp = requests.get(
            f"{BASE_URL}/api/teacher/exams",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        exams = exams_resp.json()
        
        if not exams:
            pytest.skip("No exams assigned to teacher")
        
        exam = exams[0]
        subjects = exam.get('subjects', [])
        
        if not subjects:
            pytest.skip("No subjects in exam")
        
        subject_id = subjects[0]['id']
        
        students_resp = requests.get(
            f"{BASE_URL}/api/teacher/exam-marks/{exam['id']}/{subject_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        students_data = students_resp.json()
        students = students_data.get('students', [])
        
        if not students:
            pytest.skip("No students found")
        
        invalid_entry = {
            "exam_id": exam['id'],
            "subject_id": subject_id,
            "student_id": students[0]['student_id'],
            "marks_obtained": -10,  # Negative marks
            "remarks": "Invalid negative marks test"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/teacher/exam-marks",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json=invalid_entry
        )
        assert response.status_code == 400, f"Should reject negative marks: {response.text}"
        print("Validation working: Negative marks rejected")
    
    def test_csv_upload_marks(self, teacher_token):
        """Teacher can upload marks via CSV"""
        exams_resp = requests.get(
            f"{BASE_URL}/api/teacher/exams",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        exams = exams_resp.json()
        
        if not exams:
            pytest.skip("No exams assigned to teacher")
        
        exam = exams[0]
        subjects = exam.get('subjects', [])
        
        if not subjects:
            pytest.skip("No subjects in exam")
        
        subject_id = subjects[0]['id']
        
        # Get students to create valid CSV
        students_resp = requests.get(
            f"{BASE_URL}/api/teacher/exam-marks/{exam['id']}/{subject_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        students_data = students_resp.json()
        students = students_data.get('students', [])
        
        if not students:
            pytest.skip("No students found")
        
        # Create CSV content
        csv_content = "USN,Marks,Remarks\n"
        for i, student in enumerate(students[:2]):
            marks = min(40 + i * 10, exam.get('max_marks', 100))
            csv_content += f"{student['usn']},{marks},CSV upload test\n"
        
        # Upload CSV
        files = {'file': ('marks.csv', csv_content, 'text/csv')}
        response = requests.post(
            f"{BASE_URL}/api/teacher/exam-marks/csv-upload?exam_id={exam['id']}&subject_id={subject_id}",
            headers={"Authorization": f"Bearer {teacher_token}"},
            files=files
        )
        assert response.status_code == 200, f"CSV upload failed: {response.text}"
        data = response.json()
        print(f"CSV upload result: {data.get('message')}")
        print(f"  Success: {data.get('success_count')}, Failed: {data.get('failed_count')}")
    
    def test_csv_upload_validation(self, teacher_token):
        """CSV upload validates invalid rows"""
        exams_resp = requests.get(
            f"{BASE_URL}/api/teacher/exams",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        exams = exams_resp.json()
        
        if not exams:
            pytest.skip("No exams assigned to teacher")
        
        exam = exams[0]
        subjects = exam.get('subjects', [])
        
        if not subjects:
            pytest.skip("No subjects in exam")
        
        subject_id = subjects[0]['id']
        
        # Create CSV with invalid data
        csv_content = "USN,Marks,Remarks\n"
        csv_content += f"INVALID_USN,50,Invalid student\n"  # Invalid USN
        csv_content += f"1MS21CS001,{exam.get('max_marks', 100) + 100},Exceeds max\n"  # Exceeds max
        csv_content += f"1MS21CS002,-10,Negative marks\n"  # Negative
        
        files = {'file': ('marks.csv', csv_content, 'text/csv')}
        response = requests.post(
            f"{BASE_URL}/api/teacher/exam-marks/csv-upload?exam_id={exam['id']}&subject_id={subject_id}",
            headers={"Authorization": f"Bearer {teacher_token}"},
            files=files
        )
        assert response.status_code == 200, f"CSV upload failed: {response.text}"
        data = response.json()
        assert data.get('failed_count', 0) > 0, "Should have failed rows"
        print(f"CSV validation working: {data.get('failed_count')} rows rejected")
        for failed in data.get('failed_rows', []):
            print(f"  Row {failed.get('row')}: {failed.get('reason')}")
    
    def test_view_class_performance(self, teacher_token):
        """Teacher can view class performance summary"""
        exams_resp = requests.get(
            f"{BASE_URL}/api/teacher/exams",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        exams = exams_resp.json()
        
        if not exams:
            pytest.skip("No exams assigned to teacher")
        
        exam = exams[0]
        
        response = requests.get(
            f"{BASE_URL}/api/teacher/exam-performance/{exam['id']}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Failed to get performance: {response.text}"
        data = response.json()
        assert "subject_stats" in data
        print(f"Performance summary for {exam['exam_name']}:")
        for stat in data.get('subject_stats', []):
            print(f"  {stat.get('subject_name')}: Avg={stat.get('average')}, Pass={stat.get('pass_count')}, Fail={stat.get('fail_count')}")


class TestStudentMarksView:
    """Student marks viewing and report download"""
    
    def test_student_view_marks(self, student_token):
        """Student can view their marks"""
        response = requests.get(
            f"{BASE_URL}/api/student/exam-marks",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200, f"Failed to get student marks: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Student has marks in {len(data)} exams")
        for exam_data in data:
            exam = exam_data.get('exam', {})
            print(f"  {exam.get('exam_name')}: {exam_data.get('overall_percentage')}% ({exam_data.get('overall_grade')})")
    
    def test_student_download_csv_report(self, student_token):
        """Student can download CSV report card"""
        response = requests.get(
            f"{BASE_URL}/api/student/report-card/csv",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200, f"Failed to download CSV: {response.text}"
        assert 'text/csv' in response.headers.get('content-type', '')
        print("CSV report card download successful")
    
    def test_student_download_pdf_report(self, student_token):
        """Student can download PDF report card"""
        response = requests.get(
            f"{BASE_URL}/api/student/report-card/pdf",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        # May return 404 if no marks exist
        if response.status_code == 404:
            print("No marks found for PDF generation (expected if no marks entered)")
            return
        assert response.status_code == 200, f"Failed to download PDF: {response.text}"
        assert 'application/pdf' in response.headers.get('content-type', '')
        print("PDF report card download successful")


class TestRoleBasedAccess:
    """Role-based access control tests"""
    
    def test_student_cannot_access_admin_exams(self, student_token):
        """Student cannot access admin exam endpoints"""
        response = requests.get(
            f"{BASE_URL}/api/admin/exams",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 403, f"Student should not access admin exams: {response.status_code}"
        print("Role-based access working: Student blocked from admin endpoints")
    
    def test_student_cannot_enter_marks(self, student_token):
        """Student cannot enter marks"""
        response = requests.post(
            f"{BASE_URL}/api/teacher/exam-marks",
            headers={"Authorization": f"Bearer {student_token}"},
            json={
                "exam_id": "test",
                "subject_id": "test",
                "student_id": "test",
                "marks_obtained": 50
            }
        )
        assert response.status_code == 403, f"Student should not enter marks: {response.status_code}"
        print("Role-based access working: Student blocked from teacher endpoints")
    
    def test_teacher_cannot_create_exam(self, teacher_token):
        """Teacher cannot create exams (admin only)"""
        response = requests.post(
            f"{BASE_URL}/api/admin/exams",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json={
                "exam_name": "Unauthorized Exam",
                "exam_type": "Midterm",
                "date": "2026-01-01",
                "branch": "CSE",
                "semester": 5,
                "section": "A",
                "subject_ids": [],
                "max_marks": 100
            }
        )
        assert response.status_code == 403, f"Teacher should not create exams: {response.status_code}"
        print("Role-based access working: Teacher blocked from admin exam creation")


class TestSessionPersistence:
    """Session persistence tests"""
    
    def test_token_refresh(self):
        """Token refresh works for session persistence"""
        # Login to get tokens
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
        tokens = login_resp.json()
        refresh_token = tokens.get("refresh_token")
        
        # Use refresh token
        refresh_resp = requests.post(f"{BASE_URL}/api/auth/refresh", json={
            "refresh_token": refresh_token
        })
        assert refresh_resp.status_code == 200, f"Token refresh failed: {refresh_resp.text}"
        new_tokens = refresh_resp.json()
        assert "access_token" in new_tokens
        print("Token refresh working for session persistence")
    
    def test_auth_me_endpoint(self):
        """Auth me endpoint returns user info"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json().get("access_token")
        
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_resp.status_code == 200, f"Auth me failed: {me_resp.text}"
        user = me_resp.json()
        assert user.get("email") == ADMIN_EMAIL
        print(f"Auth me working: {user.get('name')} ({user.get('role')})")


class TestCleanup:
    """Cleanup test data"""
    
    def test_delete_test_exam(self, admin_token):
        """Delete test exam created during tests"""
        exams_resp = requests.get(
            f"{BASE_URL}/api/admin/exams",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        exams = exams_resp.json()
        
        for exam in exams:
            if exam.get('exam_name', '').startswith('TEST_'):
                delete_resp = requests.delete(
                    f"{BASE_URL}/api/admin/exams/{exam['id']}",
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                if delete_resp.status_code == 200:
                    print(f"Deleted test exam: {exam['exam_name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
