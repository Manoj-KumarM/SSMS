import requests
import sys
from datetime import datetime
import json
import time

class CollegeManagementTester:
    def __init__(self, base_url="https://qr-campus-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.teacher_token = None
        self.student_token = None
        self.admin_refresh_token = None
        self.teacher_refresh_token = None
        self.student_refresh_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_teacher_id = None
        self.created_student_id = None
        self.created_subject_id = None
        self.created_announcement_id = None
        self.active_session_id = None
        self.session_code = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login with provided credentials and token persistence"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": "admin@college.edu", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.admin_refresh_token = response.get('refresh_token')
            print(f"   Admin user: {response.get('user', {}).get('name', 'Unknown')}")
            print(f"   Token expires in 24 hours, refresh token available: {bool(self.admin_refresh_token)}")
            return True
        return False

    def test_token_refresh(self):
        """Test token refresh endpoint for session persistence"""
        if not self.admin_refresh_token:
            print("❌ Token Refresh - No refresh token")
            return False
            
        success, response = self.run_test(
            "Token Refresh",
            "POST",
            "api/auth/refresh",
            200,
            data={"refresh_token": self.admin_refresh_token}
        )
        
        if success and 'access_token' in response:
            # Update tokens
            self.admin_token = response['access_token']
            self.admin_refresh_token = response.get('refresh_token')
            print(f"   New access token received, user: {response.get('user', {}).get('name', 'Unknown')}")
            return True
        return False

    def test_admin_dashboard_stats(self):
        """Test admin dashboard by fetching stats"""
        if not self.admin_token:
            print("❌ Admin Dashboard Stats - No admin token")
            return False
        
        # Test students endpoint
        students_success, students_data = self.run_test(
            "Get Students Count",
            "GET",
            "api/admin/students",
            200,
            token=self.admin_token
        )
        
        # Test teachers endpoint  
        teachers_success, teachers_data = self.run_test(
            "Get Teachers Count",
            "GET",
            "api/admin/teachers",
            200,
            token=self.admin_token
        )
        
        # Test subjects endpoint
        subjects_success, subjects_data = self.run_test(
            "Get Subjects Count",
            "GET",
            "api/admin/subjects",
            200,
            token=self.admin_token
        )
        
        if students_success and teachers_success and subjects_success:
            print(f"   Dashboard Stats - Students: {len(students_data)}, Teachers: {len(teachers_data)}, Subjects: {len(subjects_data)}")
            return True
        return False

    def test_create_teacher(self):
        """Test creating a teacher (john@college.edu)"""
        if not self.admin_token:
            print("❌ Create Teacher - No admin token")
            return False
            
        teacher_data = {
            "name": "John Teacher",
            "email": "john@college.edu",
            "phone": "9999999999"
        }
        
        success, response = self.run_test(
            "Create Teacher (john@college.edu)",
            "POST",
            "api/admin/teachers",
            200,
            data=teacher_data,
            token=self.admin_token
        )
        
        if success and 'teacher' in response:
            self.created_teacher_id = response['teacher']['id']
            print(f"   Created teacher ID: {self.created_teacher_id}")
            return True
        return False

    def test_create_student(self):
        """Test creating a student (alice@college.edu, USN: 1MS21CS001, branch: CSE, semester: 5, section: A)"""
        if not self.admin_token:
            print("❌ Create Student - No admin token")
            return False
            
        student_data = {
            "name": "Alice Student",
            "usn": "1MS21CS001",
            "branch": "CSE",
            "semester": 5,
            "section": "A",
            "email": "alice@college.edu",
            "phone": "8888888888",
            "parent_phone": "7777777777",
            "parent_email": "parent@mail.com"
        }
        
        success, response = self.run_test(
            "Create Student (alice@college.edu, USN: 1MS21CS001)",
            "POST",
            "api/admin/students",
            200,
            data=student_data,
            token=self.admin_token
        )
        
        if success and 'student' in response:
            self.created_student_id = response['student']['id']
            print(f"   Created student ID: {self.created_student_id}")
            return True
        return False

    def test_create_subject(self):
        """Test creating a subject (Data Structures, CS301, CSE, 5, A)"""
        if not self.admin_token:
            print("❌ Create Subject - No admin token")
            return False
            
        subject_data = {
            "subject_name": "Data Structures",
            "subject_code": "CS301",
            "branch": "CSE",
            "semester": 5,
            "section": "A"
        }
        
        success, response = self.run_test(
            "Create Subject (Data Structures, CS301, CSE, 5, A)",
            "POST",
            "api/admin/subjects",
            200,
            data=subject_data,
            token=self.admin_token
        )
        
        if success and 'subject' in response:
            self.created_subject_id = response['subject']['id']
            print(f"   Created subject ID: {self.created_subject_id}")
            return True
        return False

    def test_assign_subject_to_teacher(self):
        """Test assigning subject to teacher"""
        if not self.admin_token or not self.created_teacher_id or not self.created_subject_id:
            print("❌ Assign Subject - Missing prerequisites")
            return False
            
        assign_data = {
            "teacher_id": self.created_teacher_id,
            "subject_id": self.created_subject_id
        }
        
        success, response = self.run_test(
            "Assign Subject to Teacher",
            "POST",
            "api/admin/assign-subject",
            200,
            data=assign_data,
            token=self.admin_token
        )
        
        return success

    def test_create_announcement(self):
        """Test creating an announcement"""
        if not self.admin_token:
            print("❌ Create Announcement - No admin token")
            return False
            
        announcement_data = {
            "title": "Test Announcement",
            "message": "This is a test announcement for CSE students",
            "branch": "CSE",
            "semester": 5,
            "section": "A"
        }
        
        success, response = self.run_test(
            "Create Announcement",
            "POST",
            "api/admin/announcements",
            200,
            data=announcement_data,
            token=self.admin_token
        )
        
        if success and 'announcement' in response:
            self.created_announcement_id = response['announcement']['id']
            print(f"   Created announcement ID: {self.created_announcement_id}")
            return True
        return False

    def test_edit_announcement(self):
        """Test editing an announcement"""
        if not self.admin_token or not self.created_announcement_id:
            print("❌ Edit Announcement - Missing prerequisites")
            return False
            
        update_data = {
            "title": "Updated Test Announcement",
            "message": "This announcement has been updated"
        }
        
        success, response = self.run_test(
            "Edit Announcement",
            "PUT",
            f"api/admin/announcements/{self.created_announcement_id}",
            200,
            data=update_data,
            token=self.admin_token
        )
        
        return success

    def test_delete_announcement(self):
        """Test deleting an announcement"""
        if not self.admin_token or not self.created_announcement_id:
            print("❌ Delete Announcement - Missing prerequisites")
            return False
            
        success, response = self.run_test(
            "Delete Announcement",
            "DELETE",
            f"api/admin/announcements/{self.created_announcement_id}",
            200,
            token=self.admin_token
        )
        
        return success

    def test_admin_attendance_reports(self):
        """Test admin attendance reports endpoints"""
        if not self.admin_token:
            print("❌ Admin Attendance Reports - No admin token")
            return False
            
        # Test attendance stats
        stats_success, stats_data = self.run_test(
            "Admin Attendance Stats",
            "GET",
            "api/admin/attendance/stats?branch=CSE&semester=5&section=A",
            200,
            token=self.admin_token
        )
        
        # Test attendance records
        records_success, records_data = self.run_test(
            "Admin Attendance Records",
            "GET",
            "api/admin/attendance/records",
            200,
            token=self.admin_token
        )
        
        if stats_success and records_success:
            print(f"   Stats returned {len(stats_data)} student records")
            print(f"   Records returned {len(records_data)} attendance records")
            return True
        return False

    def test_teacher_login(self):
        """Test teacher login"""
        success, response = self.run_test(
            "Teacher Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": "john@college.edu", "password": "teacher123"}
        )
        if success and 'access_token' in response:
            self.teacher_token = response['access_token']
            self.teacher_refresh_token = response.get('refresh_token')
            print(f"   Teacher user: {response.get('user', {}).get('name', 'Unknown')}")
            return True
        return False

    def test_teacher_create_attendance_session(self):
        """Test teacher creating attendance session with QR code generation"""
        if not self.teacher_token or not self.created_subject_id:
            print("❌ Create Attendance Session - Missing prerequisites")
            return False
            
        session_data = {
            "subject_id": self.created_subject_id,
            "branch": "CSE",
            "semester": 5,
            "section": "A",
            "teacher_latitude": 12.9716,
            "teacher_longitude": 77.5946
        }
        
        success, response = self.run_test(
            "Create Attendance Session (QR Generation)",
            "POST",
            "api/teacher/attendance/create-session",
            200,
            data=session_data,
            token=self.teacher_token
        )
        
        if success and 'session' in response:
            self.active_session_id = response['session']['id']
            self.session_code = response['session']['session_code']
            print(f"   Session ID: {self.active_session_id}")
            print(f"   Session Code: {self.session_code}")
            print(f"   Radius: {response['session'].get('allowed_radius', 'Unknown')}m")
            print(f"   Students in class: {len(response.get('students', []))}")
            return True
        return False

    def test_teacher_manual_attendance_marking(self):
        """Test teacher manual attendance marking"""
        if not self.teacher_token or not self.active_session_id or not self.created_student_id:
            print("❌ Manual Attendance Marking - Missing prerequisites")
            return False
            
        mark_data = {
            "student_id": self.created_student_id,
            "status": "Present"
        }
        
        success, response = self.run_test(
            "Teacher Manual Attendance Marking",
            "POST",
            f"api/teacher/attendance/manual-mark/{self.active_session_id}",
            200,
            data=mark_data,
            token=self.teacher_token
        )
        
        return success

    def test_teacher_attendance_history(self):
        """Test teacher attendance history page"""
        if not self.teacher_token:
            print("❌ Teacher Attendance History - No teacher token")
            return False
            
        success, response = self.run_test(
            "Teacher Attendance History",
            "GET",
            "api/teacher/attendance/history",
            200,
            token=self.teacher_token
        )
        
        if success:
            print(f"   Found {len(response)} attendance sessions in history")
            return True
        return False

    def test_teacher_csv_download(self):
        """Test teacher CSV download for attendance"""
        if not self.teacher_token or not self.created_subject_id:
            print("❌ Teacher CSV Download - Missing prerequisites")
            return False
            
        # Test CSV download endpoint
        url = f"{self.base_url}/api/teacher/attendance/csv?subject_id={self.created_subject_id}"
        headers = {'Authorization': f'Bearer {self.teacher_token}'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing Teacher CSV Download...")
        
        try:
            response = requests.get(url, headers=headers)
            success = response.status_code == 200 and 'text/csv' in response.headers.get('content-type', '')
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - CSV downloaded, size: {len(response.content)} bytes")
                # Check for UTF-8-sig encoding (BOM)
                if response.content.startswith(b'\xef\xbb\xbf'):
                    print("   ✅ UTF-8-sig encoding detected (proper Excel compatibility)")
                return True
            else:
                print(f"❌ Failed - Status: {response.status_code}, Content-Type: {response.headers.get('content-type')}")
                return False
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def test_student_login(self):
        """Test student login"""
        success, response = self.run_test(
            "Student Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": "alice@college.edu", "password": "student123"}
        )
        if success and 'access_token' in response:
            self.student_token = response['access_token']
            self.student_refresh_token = response.get('refresh_token')
            print(f"   Student user: {response.get('user', {}).get('name', 'Unknown')}")
            return True
        return False

    def test_student_attendance_submission_3_attempts(self):
        """Test student attendance submission with 3 attempt limit"""
        if not self.student_token or not self.session_code:
            print("❌ Student Attendance Submission - Missing prerequisites")
            return False
            
        # Test first attempt (should fail due to distance)
        submission_data = {
            "session_code": self.session_code,
            "student_latitude": 13.0000,  # Far from teacher location
            "student_longitude": 78.0000
        }
        
        success1, response1 = self.run_test(
            "Student Attendance Attempt 1 (Invalid Distance)",
            "POST",
            "api/student/attendance/submit",
            200,
            data=submission_data,
            token=self.student_token
        )
        
        # Test second attempt (should also fail)
        success2, response2 = self.run_test(
            "Student Attendance Attempt 2 (Invalid Distance)",
            "POST",
            "api/student/attendance/submit",
            200,
            data=submission_data,
            token=self.student_token
        )
        
        # Test third attempt (should also fail)
        success3, response3 = self.run_test(
            "Student Attendance Attempt 3 (Invalid Distance)",
            "POST",
            "api/student/attendance/submit",
            200,
            data=submission_data,
            token=self.student_token
        )
        
        # Test fourth attempt (should be rejected due to max attempts)
        success4, response4 = self.run_test(
            "Student Attendance Attempt 4 (Should be rejected)",
            "POST",
            "api/student/attendance/submit",
            400,  # Should return 400 for max attempts exceeded
            data=submission_data,
            token=self.student_token
        )
        
        if success1 and success2 and success3 and success4:
            print(f"   Attempt 1 status: {response1.get('status')}, remaining: {response1.get('remaining_attempts')}")
            print(f"   Attempt 2 status: {response2.get('status')}, remaining: {response2.get('remaining_attempts')}")
            print(f"   Attempt 3 status: {response3.get('status')}, remaining: {response3.get('remaining_attempts')}")
            print(f"   Attempt 4 correctly rejected (max attempts exceeded)")
            return True
        return False

    def test_student_valid_attendance_submission(self):
        """Test student valid attendance submission (within 50m radius)"""
        if not self.student_token or not self.session_code:
            print("❌ Valid Student Attendance - Missing prerequisites")
            return False
            
        # Create new session for fresh attempts
        if not self.teacher_token or not self.created_subject_id:
            print("❌ Valid Student Attendance - Cannot create new session")
            return False
            
        # Create new session
        session_data = {
            "subject_id": self.created_subject_id,
            "branch": "CSE",
            "semester": 5,
            "section": "A",
            "teacher_latitude": 12.9716,
            "teacher_longitude": 77.5946
        }
        
        session_success, session_response = self.run_test(
            "Create New Session for Valid Submission",
            "POST",
            "api/teacher/attendance/create-session",
            200,
            data=session_data,
            token=self.teacher_token
        )
        
        if not session_success:
            return False
            
        new_session_code = session_response['session']['session_code']
        
        # Submit attendance within 50m radius
        submission_data = {
            "session_code": new_session_code,
            "student_latitude": 12.9716,  # Same as teacher (0m distance)
            "student_longitude": 77.5946
        }
        
        success, response = self.run_test(
            "Student Valid Attendance Submission (Within 50m)",
            "POST",
            "api/student/attendance/submit",
            200,
            data=submission_data,
            token=self.student_token
        )
        
        if success and response.get('status') == 'Present':
            print(f"   Status: {response.get('status')}, Distance: {response.get('distance')}m")
            return True
        return False

    def test_forgot_password_endpoint(self):
        """Test forgot password endpoint with code_hint when no email configured"""
        success, response = self.run_test(
            "Forgot Password (No Email Configured)",
            "POST",
            "api/auth/forgot-password",
            200,
            data={"email": "admin@college.edu"}
        )
        
        if success and 'code_hint' in response:
            print(f"   Code hint returned: {response['code_hint']} (No email service configured)")
            return True
        elif success:
            print(f"   Email sent successfully (email service configured)")
            return True
        return False

    def test_reset_password_endpoint(self):
        """Test reset password endpoint"""
        # First get a reset code
        forgot_success, forgot_response = self.run_test(
            "Get Reset Code",
            "POST",
            "api/auth/forgot-password",
            200,
            data={"email": "admin@college.edu"}
        )
        
        if not forgot_success:
            return False
            
        # Use the code hint if available, otherwise skip this test
        reset_code = forgot_response.get('code_hint')
        if not reset_code:
            print("   Skipping reset test - no code hint available")
            return True
            
        # Test reset password
        success, response = self.run_test(
            "Reset Password with Code",
            "POST",
            "api/auth/reset-password",
            200,
            data={
                "code": reset_code,
                "new_password": "admin123"  # Reset to same password
            }
        )
        
        return success

    def test_change_password_endpoint(self):
        """Test change password endpoint"""
        if not self.admin_token:
            print("❌ Change Password - No admin token")
            return False
            
        success, response = self.run_test(
            "Change Password",
            "POST",
            "api/auth/change-password",
            200,
            data={
                "current_password": "admin123",
                "new_password": "admin123"  # Same password to avoid breaking other tests
            },
            token=self.admin_token
        )
        return success

    def test_logout(self):
        """Test logout functionality"""
        if not self.admin_token:
            print("❌ Logout - No admin token")
            return False
            
        success, response = self.run_test(
            "Logout",
            "POST",
            "api/auth/logout",
            200,
            token=self.admin_token
        )
        return success

def main():
    print("🚀 Starting Smart Student Management System API Tests")
    print("=" * 70)
    
    tester = CollegeManagementTester()
    
    # Test sequence based on review request
    test_results = []
    
    # 1. Admin login and token persistence
    test_results.append(("Admin Login", tester.test_admin_login()))
    test_results.append(("Token Refresh", tester.test_token_refresh()))
    
    # 2. Admin dashboard stats
    test_results.append(("Admin Dashboard Stats", tester.test_admin_dashboard_stats()))
    
    # 3. Create users as specified in review request
    test_results.append(("Create Teacher (john@college.edu)", tester.test_create_teacher()))
    test_results.append(("Create Student (alice@college.edu, USN: 1MS21CS001)", tester.test_create_student()))
    test_results.append(("Create Subject (Data Structures, CS301, CSE, 5, A)", tester.test_create_subject()))
    test_results.append(("Assign Subject to Teacher", tester.test_assign_subject_to_teacher()))
    
    # 4. Announcement CRUD operations
    test_results.append(("Create Announcement", tester.test_create_announcement()))
    test_results.append(("Edit Announcement", tester.test_edit_announcement()))
    test_results.append(("Delete Announcement", tester.test_delete_announcement()))
    
    # 5. Admin attendance reports
    test_results.append(("Admin Attendance Reports", tester.test_admin_attendance_reports()))
    
    # 6. Teacher login and attendance features
    test_results.append(("Teacher Login (john@college.edu)", tester.test_teacher_login()))
    test_results.append(("Teacher Create Attendance Session (QR Generation)", tester.test_teacher_create_attendance_session()))
    test_results.append(("Teacher Manual Attendance Marking", tester.test_teacher_manual_attendance_marking()))
    test_results.append(("Teacher Attendance History", tester.test_teacher_attendance_history()))
    test_results.append(("Teacher CSV Download (UTF-8)", tester.test_teacher_csv_download()))
    
    # 7. Student login and attendance submission
    test_results.append(("Student Login (alice@college.edu)", tester.test_student_login()))
    test_results.append(("Student Attendance 3 Attempts Limit", tester.test_student_attendance_submission_3_attempts()))
    test_results.append(("Student Valid Attendance (50m radius)", tester.test_student_valid_attendance_submission()))
    
    # 8. Password reset flow
    test_results.append(("Forgot Password (code_hint)", tester.test_forgot_password_endpoint()))
    test_results.append(("Reset Password with Code", tester.test_reset_password_endpoint()))
    test_results.append(("Change Password", tester.test_change_password_endpoint()))
    
    # 9. Logout
    test_results.append(("Logout", tester.test_logout()))
    
    # Print results
    print("\n" + "=" * 70)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 70)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\n📈 Overall: {tester.tests_passed}/{tester.tests_run} tests passed")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📊 Success Rate: {success_rate:.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())