import json
import frappe
from frappe import _

def get_context(context):
	"""
	Main controller function - validates params and prepares context for template
	"""
	csrf_token = frappe.sessions.get_csrf_token()
	frappe.db.commit()
	
	# Validate required query parameters
	validate_query_params()
	print(frappe.form_dict)
	job_opening_name = frappe.form_dict.get('job')
	
	# Fetch job opening details
	try:
		job_opening = frappe.get_doc('Job Opening', job_opening_name)
	except frappe.DoesNotExistError:
		frappe.throw(_('Job Opening not found'), frappe.DoesNotExistError)
		return
	
	# Check if user has already applied for this job
	email = frappe.session.user
	if email != 'Guest':
		existing_application = frappe.db.exists('Job Applicant', {
			'job_title': job_opening_name,
			'email_id': email
		})
		if existing_application:
			context.has_applied = True
			context.job_title = job_opening.job_title
			return
	
	# Prepare context data
	context.job_opening = job_opening.name
	context.job_title = job_opening.job_title
	context.company = job_opening.company
	context.department = job_opening.department or None
	context.location = job_opening.location or None
	context.employment_type = job_opening.employment_type or None
	
	# Fetch screening questions from custom child table
	questions = []
	if hasattr(job_opening, 'custom_job_applicant_screening_answer') and job_opening.custom_job_applicant_screening_answer:
		for q in job_opening.custom_job_applicant_screening_answer:
			question_data = {}
			question_data['name'] = q.name
			question_data['question'] = q.question
			question_data['required'] = q.required
			question_data['questiontype'] = q.question_type
			question_data['options'] = q.options or ''
			question_data['placeholdertext'] = q.placeholder_text or ''
			question_data['minallowedanswers'] = q.min_allowed_answers or 1
			question_data['maxallowedanswers'] = q.max_allowed_answers or 1
			questions.append(question_data)
	
	context.questions = questions
	context.questions_json = json.dumps(questions)
	context.has_applied = False


def validate_query_params():
	"""
	Validates that required query parameters are present
	"""
	if not frappe.form_dict.get('job'):
		frappe.throw(
			_('Job opening parameter is missing. Please access this page from the jobs listing.'),
			frappe.ValidationError
		)


@frappe.whitelist(allow_guest=True)
def create_job_applicant(data):
	"""
	Create initial Job Applicant document after Step 1
	Args:
		data: JSON string containing basic applicant information
	"""
	data = frappe._dict(json.loads(data))
	
	# Validate basic fields
	required_fields = ['fullName', 'email', 'phone', 'location', 'experience', 'job_opening']
	for field in required_fields:
		if not data.get(field):
			frappe.throw(_(f'{field} is required'))
	
	# Validate email format
	import re
	email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
	if not re.match(email_pattern, data.email):
		frappe.throw(_('Invalid email address format'))
	
	# Check for duplicate application
	existing = frappe.db.exists('Job Applicant', {
		'job_title': data.job_opening,
		'email_id': data.email
	})
	
	if existing:
		frappe.throw(_('You have already applied for this position'))
	
	# Create Job Applicant document with basic details
	doc = frappe.get_doc({
		'doctype': 'Job Applicant',
		'applicant_name': data.fullName,
		'email_id': data.email,
		'phone_number': data.phone,
		'job_title': data.job_opening,
		'status': 'Open',
		'source': 'Website Listing',
		'cover_letter': json.dumps({
			'location': data.location,
			'experience': f"{data.experience} years"
		}, indent=2)
	})
	
	doc.flags.ignore_permissions = True
	doc.insert()
	
	return {
		'success': True,
		'message': 'Basic information saved',
		'applicant_name': doc.name
	}


@frappe.whitelist(allow_guest=True)
def update_job_application(submission):
	"""
	Update Job Applicant document with complete application data
	Args:
		submission: JSON string containing all form data and answers
	"""
	submission = frappe._dict(json.loads(submission))
	
	# Validate applicant_name is provided
	if not submission.get('applicant_name'):
		frappe.throw(_('Job Applicant reference is missing'))
	
	# Get existing Job Applicant document
	try:
		doc = frappe.get_doc('Job Applicant', submission.applicant_name)
	except frappe.DoesNotExistError:
		frappe.throw(_('Job Applicant not found'))
	
	# Validate submission
	validate_submission(submission)
	
	# Prepare screening answers
	answers = prepare_answers(submission)
	
	# Update document with complete information
	doc.cover_letter = json.dumps({
		'location': submission.location,
		'experience': f"{submission.experience} years",
		'linkedin': submission.get('linkedin', ''),
		'portfolio': submission.get('portfolio', ''),
		'expected_salary': f"{submission.currency} {submission.salaryMin} - {submission.salaryMax}",
		'notice_period': submission.noticePeriod
	}, indent=2)
	
	# Add resume attachment if provided
	if submission.get('resume_url'):
		doc.resume_attachment = submission.resume_url
	
	# Add screening answers
	doc.custom_job_applicant_screening_answer = answers
	
	doc.flags.ignore_permissions = True
	doc.save()
	
	return {
		'success': True,
		'message': 'Application submitted successfully',
		'applicant_name': doc.name
	}


def prepare_answers(submission):
	"""
	Prepares screening answers array from submission data
	"""
	answers = []
	questions = frappe._dict(submission.get('questions_json', '{}'))
	
	for question_index, question_data in questions.items():
		answer_value = submission.answers.get(question_index, '')
		
		if not answer_value:
			continue
		
		# Handle multiple choice multiple answers - join array into string
		if isinstance(answer_value, list):
			answer_value = ', '.join(answer_value)
		
		answers.append({
			'question_link': question_data.get('name'),
			'question': question_data.get('question'),
			'answer': answer_value
		})
	
	return answers


def validate_submission(submission):
	"""
	Server-side validation of form submission
	"""
	errors = []
	
	# Validate required fields
	required_fields = {
		'fullName': 'Full Name',
		'email': 'Email Address',
		'phone': 'Phone Number',
		'location': 'Location',
		'experience': 'Experience',
		'salaryMin': 'Minimum Salary',
		'salaryMax': 'Maximum Salary',
		'currency': 'Currency',
		'noticePeriod': 'Notice Period'
	}
	
	for field, label in required_fields.items():
		if not submission.get(field):
			errors.append(f"{label} is required")
	
	# Validate email format
	if submission.get('email'):
		import re
		email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
		if not re.match(email_pattern, submission.email):
			errors.append("Invalid email address format")
	
	# Validate salary range
	if submission.get('salaryMin') and submission.get('salaryMax'):
		try:
			if float(submission.salaryMin) > float(submission.salaryMax):
				errors.append("Minimum salary cannot be greater than maximum salary")
		except (ValueError, TypeError):
			errors.append("Invalid salary values")
	
	print(json.dumps(submission))
	# Validate screening questions
	
	questions = frappe._dict(submission.get('questions_json', '{}'))
	
	for question_index, question_data in questions.items():
		question_text = question_data.get('question', f'Question {question_index}')
		answer = submission.answers.get(question_index)
		
		# Check required questions
		if question_data.get('required') and not answer:
			errors.append(f"'{question_text}' is required")
		
		# Validate MCQ multiple answers constraints
		question_type = question_data.get('questiontype', '')
		if question_type == 'MCQ - Multiple Answers' and answer:
			if isinstance(answer, list):
				num_answers = len(answer)
				min_allowed = int(question_data.get('minallowedanswers', 1))
				max_allowed = question_data.get('maxallowedanswers')
				max_allowed = int(max_allowed) if max_allowed else None
				
				if num_answers < min_allowed:
					errors.append(f"'{question_text}' requires at least {min_allowed} option(s)")
				
				if max_allowed and num_answers > max_allowed:
					errors.append(f"'{question_text}' allows maximum {max_allowed} option(s)")
	
	if errors:
		error_html = '<br>'.join([f"• {error}" for error in errors])
		frappe.throw(
			f"<strong>Please fix the following errors:</strong><br><br>{error_html}",
			frappe.ValidationError
		)