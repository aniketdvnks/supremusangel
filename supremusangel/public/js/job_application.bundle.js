// window.JobApplication = window.JobApplication || {};

// (function() {
//     let currentStep = 1;
//     const totalSteps = 4;
    
//     // Initialize on page load
//     document.addEventListener('DOMContentLoaded', function() {
//         // Wait for frappe to be available or use data attributes
//         const jobData = window.frappe?.job_application || getJobDataFromPage();
//         if (jobData && jobData.job_opening) {
//             initializeApplication();
//         }
//     });
    
//     // Fallback: Get job data from script tag if frappe not loaded yet
//     function getJobDataFromPage() {
//         try {
//             const scriptTag = document.querySelector('script[data-job-data]');
//             return scriptTag ? JSON.parse(scriptTag.getAttribute('data-job-data')) : null;
//         } catch (e) {
//             return null;
//         }
//     }
    
//     function initializeApplication() {
//         setupFileUpload();
//         updateStepDisplay();
//     }
    
//     // Step Navigation
//     window.JobApplication.nextStep = function() {
//         if (!validateStep(currentStep)) {
//             return;
//         }
        
//         if (currentStep === totalSteps) {
//             submitApplication();
//         } else {
//             currentStep++;
//             updateStepDisplay();
//         }
//     };
    
//     window.JobApplication.previousStep = function() {
//         if (currentStep > 1) {
//             currentStep--;
//             updateStepDisplay();
//         }
//     };
    
//     function updateStepDisplay() {
//         // Hide all sections
//         document.querySelectorAll('.form-section').forEach(section => {
//             section.classList.remove('active');
//         });
        
//         // Show current section
//         const currentSection = document.getElementById(`step${currentStep}`);
//         if (currentSection) {
//             currentSection.classList.add('active');
//         }
        
//         // Update step indicators
//         document.querySelectorAll('.step').forEach((step, index) => {
//             step.classList.remove('active', 'completed');
//             if (index + 1 < currentStep) {
//                 step.classList.add('completed');
//             } else if (index + 1 === currentStep) {
//                 step.classList.add('active');
//             }
//         });
        
//         // Update progress line
//         const progressPercent = currentStep === 5 ? 100 : ((currentStep - 1) / (totalSteps - 1)) * 100;
//         document.getElementById('progressLine').style.width = progressPercent + '%';
        
//         // Update buttons
//         const prevBtn = document.getElementById('prevBtn');
//         const nextBtn = document.getElementById('nextBtn');
//         const formActions = document.getElementById('formActions');
        
//         if (currentStep === 5) {
//             formActions.style.display = 'none';
//         } else {
//             formActions.style.display = 'flex';
//             prevBtn.style.display = currentStep === 1 ? 'none' : 'inline-flex';
//             nextBtn.textContent = currentStep === totalSteps ? 'Submit Application' : 'Next';
//         }
//     }
    
//     // Validation
//     function validateStep(step) {
//         let isValid = true;
        
//         if (step === 1) {
//             const fields = ['fullName', 'email', 'phone', 'location', 'experience'];
//             fields.forEach(field => {
//                 const input = document.getElementById(field);
//                 const error = document.getElementById(field + 'Error');
                
//                 if (!input.value.trim()) {
//                     input.classList.add('error');
//                     error.classList.remove('hidden');
//                     isValid = false;
//                 } else {
//                     input.classList.remove('error');
//                     error.classList.add('hidden');
                    
//                     if (field === 'email' && !isValidEmail(input.value)) {
//                         input.classList.add('error');
//                         error.classList.remove('hidden');
//                         error.textContent = 'Please enter a valid email address';
//                         isValid = false;
//                     }
//                 }
//             });
//         }
        
//         if (step === 2) {
//             const resumeFile = document.getElementById('resumeFile');
//             const resumeError = document.getElementById('resumeError');
            
//             if (!resumeFile.files.length) {
//                 resumeError.classList.remove('hidden');
//                 isValid = false;
//             } else {
//                 resumeError.classList.add('hidden');
//             }
//         }
        
//         if (step === 3) {
//             const salaryMin = document.getElementById('salaryMin');
//             const salaryMax = document.getElementById('salaryMax');
//             const noticePeriod = document.getElementById('noticePeriod');
//             const salaryError = document.getElementById('salaryError');
//             const noticePeriodError = document.getElementById('noticePeriodError');
            
//             if (!salaryMin.value || !salaryMax.value || parseFloat(salaryMin.value) > parseFloat(salaryMax.value)) {
//                 salaryError.classList.remove('hidden');
//                 salaryError.textContent = salaryMin.value && salaryMax.value ? 
//                     'Minimum salary must be less than maximum salary' : 
//                     'Please enter valid salary range';
//                 isValid = false;
//             } else {
//                 salaryError.classList.add('hidden');
//             }
            
//             if (!noticePeriod.value) {
//                 noticePeriodError.classList.remove('hidden');
//                 isValid = false;
//             } else {
//                 noticePeriodError.classList.add('hidden');
//             }
//         }
        
//         if (step === 4) {
//             const questions = frappe.job_application.questions || [];
            
//             questions.forEach((q, index) => {
//                 const error = document.getElementById(`question${index}Error`);
//                 let hasAnswer = false;
                
//                 if (q.questiontype === 'Short Answer' || q.questiontype === 'Long Answer') {
//                     const answer = document.getElementById(`question${index}`);
//                     hasAnswer = answer && answer.value.trim();
//                     if (!hasAnswer && q.required) {
//                         answer.classList.add('error');
//                         error.classList.remove('hidden');
//                         isValid = false;
//                     } else {
//                         answer.classList.remove('error');
//                         error.classList.add('hidden');
//                     }
//                 } else if (q.questiontype === 'MCQ - Single Answer') {
//                     const selected = document.querySelector(`input[name="question${index}"]:checked`);
//                     hasAnswer = !!selected;
//                     if (!hasAnswer && q.required) {
//                         error.classList.remove('hidden');
//                         error.textContent = 'Please select an option';
//                         isValid = false;
//                     } else {
//                         error.classList.add('hidden');
//                     }
//                 } else if (q.questiontype === 'MCQ - Multiple Answers') {
//                     const selected = document.querySelectorAll(`input[name="question${index}"]:checked`);
//                     const count = selected.length;
//                     hasAnswer = count > 0;
                    
//                     if (q.required && !hasAnswer) {
//                         error.textContent = 'Please select at least one option';
//                         error.classList.remove('hidden');
//                         isValid = false;
//                     } else if (q.minallowedanswers && count < q.minallowedanswers) {
//                         error.textContent = `Please select at least ${q.minallowedanswers} option(s)`;
//                         error.classList.remove('hidden');
//                         isValid = false;
//                     } else if (q.maxallowedanswers && count > q.maxallowedanswers) {
//                         error.textContent = `Please select maximum ${q.maxallowedanswers} option(s)`;
//                         error.classList.remove('hidden');
//                         isValid = false;
//                     } else {
//                         error.classList.add('hidden');
//                     }
//                 }
//             });
//         }
        
//         return isValid;
//     }
    
//     function isValidEmail(email) {
//         return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
//     }
    
//     // File Upload
//     function setupFileUpload() {
//         const fileUploadArea = document.getElementById('fileUploadArea');
//         const resumeFile = document.getElementById('resumeFile');
        
//         if (!fileUploadArea || !resumeFile) return;
        
//         // Show message using native alert if frappe not available
//         window.showMessage = window.frappe?.msgprint || function(msg) {
//             alert(typeof msg === 'string' ? msg : msg.message || msg.title);
//         };
        
//         fileUploadArea.addEventListener('click', () => {
//             resumeFile.click();
//         });
        
//         fileUploadArea.addEventListener('dragover', (e) => {
//             e.preventDefault();
//             fileUploadArea.classList.add('active');
//         });
        
//         fileUploadArea.addEventListener('dragleave', () => {
//             fileUploadArea.classList.remove('active');
//         });
        
//         fileUploadArea.addEventListener('drop', (e) => {
//             e.preventDefault();
//             fileUploadArea.classList.remove('active');
            
//             const files = e.dataTransfer.files;
//             if (files.length > 0) {
//                 resumeFile.files = files;
//                 handleFileSelect(files[0]);
//             }
//         });
        
//         resumeFile.addEventListener('change', (e) => {
//             if (e.target.files.length > 0) {
//                 handleFileSelect(e.target.files[0]);
//             }
//         });
//     }
    
//     function handleFileSelect(file) {
//         const maxSize = 5 * 1024 * 1024; // 5MB
//         const allowedTypes = ['application/pdf', 'application/msword', 
//                              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        
//         if (!allowedTypes.includes(file.type)) {
//             window.showMessage('Please upload a PDF, DOC, or DOCX file');
//             return;
//         }
        
//         if (file.size > maxSize) {
//             window.showMessage('File size must be less than 5MB');
//             return;
//         }
        
//         document.getElementById('fileName').textContent = file.name;
//         document.getElementById('fileInfo').classList.remove('hidden');
//         document.getElementById('resumeError').classList.add('hidden');
//     }
    
//     window.JobApplication.removeFile = function() {
//         document.getElementById('resumeFile').value = '';
//         document.getElementById('fileInfo').classList.add('hidden');
//     };
    
//     // Form Submission
//     async function submitApplication() {
//         try {
//             // Show loading state
//             if (window.frappe?.dom?.freeze) {
//                 frappe.dom.freeze('Submitting application...');
//             } else {
//                 showLoadingState(true);
//             }
            
//             // Collect form data
//             const formData = {
//                 job_opening: frappe.job_application.job_opening,
//                 fullName: document.getElementById('fullName').value,
//                 email: document.getElementById('email').value,
//                 phone: document.getElementById('phone').value,
//                 location: document.getElementById('location').value,
//                 experience: document.getElementById('experience').value,
//                 linkedin: document.getElementById('linkedin').value,
//                 portfolio: document.getElementById('portfolio').value,
//                 salaryMin: document.getElementById('salaryMin').value,
//                 salaryMax: document.getElementById('salaryMax').value,
//                 currency: document.getElementById('currency').value,
//                 noticePeriod: document.getElementById('noticePeriod').value,
//                 answers: {},
//                 questions_json: {}
//             };
            
//             // Collect screening answers
//             const jobData = window.frappe?.job_application || getJobDataFromPage();
//             const questions = jobData?.questions || [];
//             questions.forEach((q, index) => {
//                 let answer = '';
                
//                 if (q.questiontype === 'Short Answer' || q.questiontype === 'Long Answer') {
//                     answer = document.getElementById(`question${index}`).value;
//                 } else if (q.questiontype === 'MCQ - Single Answer') {
//                     const selected = document.querySelector(`input[name="question${index}"]:checked`);
//                     answer = selected ? selected.value : '';
//                 } else if (q.questiontype === 'MCQ - Multiple Answers') {
//                     const selected = document.querySelectorAll(`input[name="question${index}"]:checked`);
//                     answer = Array.from(selected).map(s => s.value);
//                 }
                
//                 if (answer) {
//                     formData.answers[index] = answer;
//                     formData.questions_json[index] = q;
//                 }
//             });
            
//             // Upload resume
//             const resumeFile = document.getElementById('resumeFile').files[0];
//             if (resumeFile) {
//                 const resumeUrl = await uploadFile(resumeFile);
//                 formData.resume_url = resumeUrl;
//             }
            
//             // Submit application
//             let response;
//             if (window.frappe?.call) {
//                 response = await frappe.call({
//                     method: 'your_app.www.apply.submit_job_application',
//                     args: {
//                         submission: JSON.stringify(formData)
//                     }
//                 });
//             } else {
//                 // Fallback to fetch API
//                 const result = await fetch('/api/method/your_app.www.apply.submit_job_application', {
//                     method: 'POST',
//                     headers: {
//                         'Content-Type': 'application/json',
//                         'X-Frappe-CSRF-Token': getCsrfToken()
//                     },
//                     body: JSON.stringify({ submission: JSON.stringify(formData) })
//                 });
//                 response = { message: await result.json() };
//             }
            
//             if (window.frappe?.dom?.unfreeze) {
//                 frappe.dom.unfreeze();
//             } else {
//                 showLoadingState(false);
//             }
            
//             if (response.message.success) {
//                 document.getElementById('confirmEmail').textContent = formData.email;
//                 currentStep = 5;
//                 updateStepDisplay();
//             }
            
//         } catch (error) {
//             if (window.frappe?.dom?.unfreeze) {
//                 frappe.dom.unfreeze();
//             } else {
//                 showLoadingState(false);
//             }
//             console.error('Submission error:', error);
            
//             const errorMsg = error.message || 'Failed to submit application. Please try again.';
//             if (window.frappe?.msgprint) {
//                 frappe.msgprint({
//                     title: 'Submission Failed',
//                     message: errorMsg,
//                     indicator: 'red'
//                 });
//             } else {
//                 alert('Submission Failed: ' + errorMsg);
//             }
//         }
//     }
    
//     // Helper functions for non-frappe environments
//     function showLoadingState(show) {
//         const nextBtn = document.getElementById('nextBtn');
//         if (nextBtn) {
//             nextBtn.disabled = show;
//             nextBtn.textContent = show ? 'Submitting...' : 'Submit Application';
//         }
//     }
    
//     function getCsrfToken() {
//         return document.querySelector('meta[name="csrf-token"]')?.content || '';
//     }
    
//     async function uploadFile(file) {
//         return new Promise((resolve, reject) => {
//             const reader = new FileReader();
//             reader.onload = async function(e) {
//                 try {
//                     let response;
//                     if (window.frappe?.call) {
//                         response = await frappe.call({
//                             method: 'frappe.client.attach_file',
//                             args: {
//                                 filename: file.name,
//                                 filedata: e.target.result,
//                                 doctype: 'Job Applicant',
//                                 docname: 'temp'
//                             }
//                         });
//                         resolve(response.message.file_url);
//                     } else {
//                         // Fallback to fetch API
//                         const result = await fetch('/api/method/frappe.client.attach_file', {
//                             method: 'POST',
//                             headers: {
//                                 'Content-Type': 'application/json',
//                                 'X-Frappe-CSRF-Token': getCsrfToken()
//                             },
//                             body: JSON.stringify({
//                                 filename: file.name,
//                                 filedata: e.target.result,
//                                 doctype: 'Job Applicant',
//                                 docname: 'temp'
//                             })
//                         });
//                         const data = await result.json();
//                         resolve(data.message.file_url);
//                     }
//                 } catch (error) {
//                     reject(error);
//                 }
//             };
//             reader.readAsDataURL(file);
//         });
//     }
    
// })();

// Create namespace without frappe.provide
window.JobApplication = window.JobApplication || {};

(function() {
    let currentStep = 1;
    const totalSteps = 4;
    let applicantName = null; // Store Job Applicant document name
    
    // Initialize on page load
    document.addEventListener('DOMContentLoaded', function() {
        const jobData = window.frappe?.job_application || getJobDataFromPage();
        if (jobData && jobData.job_opening) {
            initializeApplication();
        }
    });
    
    function getJobDataFromPage() {
        try {
            const scriptTag = document.querySelector('script[data-job-data]');
            return scriptTag ? JSON.parse(scriptTag.getAttribute('data-job-data')) : null;
        } catch (e) {
            return null;
        }
    }
    
    function initializeApplication() {
        setupFileUpload();
        updateStepDisplay();
    }
    
    // Step Navigation
    window.JobApplication.nextStep = async function() {
        if (!validateStep(currentStep)) {
            return;
        }
        
        // After Step 1, create Job Applicant
        if (currentStep === 1) {
            const created = await createJobApplicant();
            if (!created) {
                return; // Don't proceed if creation failed
            }
        }
        
        // Final submission on last step
        if (currentStep === totalSteps) {
            submitApplication();
        } else {
            currentStep++;
            updateStepDisplay();
        }
    };
    
    window.JobApplication.previousStep = function() {
        if (currentStep > 1) {
            currentStep--;
            updateStepDisplay();
        }
    };
    
    // Create Job Applicant after Step 1
    async function createJobApplicant() {
        try {
            if (window.frappe?.dom?.freeze) {
                frappe.dom.freeze('Saving basic information...');
            } else {
                showLoadingState(true);
            }
            
            const basicData = {
                job_opening: frappe.job_application.job_opening,
                fullName: document.getElementById('fullName').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                location: document.getElementById('location').value,
                experience: document.getElementById('experience').value
            };
            
            let response;
            if (window.frappe?.call) {
                response = await frappe.call({
                    method: 'supremusangel.www.apply.index.create_job_applicant',
                    args: {
                        data: JSON.stringify(basicData)
                    }
                });
            } else {
                const result = await fetch('/api/method/supremusangel.www.apply.index.create_job_applicant', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Frappe-CSRF-Token': getCsrfToken()
                    },
                    body: JSON.stringify({ data: JSON.stringify(basicData) })
                });
                response = { message: await result.json() };
            }
            
            if (window.frappe?.dom?.unfreeze) {
                frappe.dom.unfreeze();
            } else {
                showLoadingState(false);
            }
            
            if (response.message && response.message.success) {
                // Store applicant name for later updates
                applicantName = response.message.applicant_name;
                return true;
            }
            
            return false;
            
        } catch (error) {
            if (window.frappe?.dom?.unfreeze) {
                frappe.dom.unfreeze();
            } else {
                showLoadingState(false);
            }
            
            console.error('Error creating applicant:', error);
            const errorMsg = error.message || 'Failed to save information. Please try again.';
            
            if (window.frappe?.msgprint) {
                frappe.msgprint({
                    title: 'Error',
                    message: errorMsg,
                    indicator: 'red'
                });
            } else {
                alert('Error: ' + errorMsg);
            }
            
            return false;
        }
    }
    
    function updateStepDisplay() {
        // Hide all sections
        document.querySelectorAll('.form-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show current section
        const currentSection = document.getElementById(`step${currentStep}`);
        if (currentSection) {
            currentSection.classList.add('active');
        }
        
        // Update step indicators
        document.querySelectorAll('.step').forEach((step, index) => {
            step.classList.remove('active', 'completed');
            if (index + 1 < currentStep) {
                step.classList.add('completed');
            } else if (index + 1 === currentStep) {
                step.classList.add('active');
            }
        });
        
        // Update progress line
        const progressPercent = currentStep === 5 ? 100 : ((currentStep - 1) / (totalSteps - 1)) * 100;
        document.getElementById('progressLine').style.width = progressPercent + '%';
        
        // Update buttons
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const formActions = document.getElementById('formActions');
        
        if (currentStep === 5) {
            formActions.style.display = 'none';
        } else {
            formActions.style.display = 'flex';
            prevBtn.style.display = currentStep === 1 ? 'none' : 'inline-flex';
            nextBtn.textContent = currentStep === totalSteps ? 'Submit Application' : 'Next';
        }
    }
    
    // Validation
    function validateStep(step) {
        let isValid = true;
        
        if (step === 1) {
            const fields = ['fullName', 'email', 'phone', 'location', 'experience'];
            fields.forEach(field => {
                const input = document.getElementById(field);
                const error = document.getElementById(field + 'Error');
                
                if (!input.value.trim()) {
                    input.classList.add('error');
                    error.classList.remove('hidden');
                    isValid = false;
                } else {
                    input.classList.remove('error');
                    error.classList.add('hidden');
                    
                    if (field === 'email' && !isValidEmail(input.value)) {
                        input.classList.add('error');
                        error.classList.remove('hidden');
                        error.textContent = 'Please enter a valid email address';
                        isValid = false;
                    }
                }
            });
        }
        
        if (step === 2) {
            const resumeFile = document.getElementById('resumeFile');
            const resumeError = document.getElementById('resumeError');
            
            if (!resumeFile.files.length) {
                resumeError.classList.remove('hidden');
                isValid = false;
            } else {
                resumeError.classList.add('hidden');
            }
        }
        
        if (step === 3) {
            const salaryMin = document.getElementById('salaryMin');
            const salaryMax = document.getElementById('salaryMax');
            const noticePeriod = document.getElementById('noticePeriod');
            const salaryError = document.getElementById('salaryError');
            const noticePeriodError = document.getElementById('noticePeriodError');
            
            if (!salaryMin.value || !salaryMax.value || parseFloat(salaryMin.value) > parseFloat(salaryMax.value)) {
                salaryError.classList.remove('hidden');
                salaryError.textContent = salaryMin.value && salaryMax.value ? 
                    'Minimum salary must be less than maximum salary' : 
                    'Please enter valid salary range';
                isValid = false;
            } else {
                salaryError.classList.add('hidden');
            }
            
            if (!noticePeriod.value) {
                noticePeriodError.classList.remove('hidden');
                isValid = false;
            } else {
                noticePeriodError.classList.add('hidden');
            }
        }
        
        if (step === 4) {
            const questions = frappe.job_application.questions || [];
            
            questions.forEach((q, index) => {
                const error = document.getElementById(`question${index}Error`);
                let hasAnswer = false;
                
                if (q.questiontype === 'Short Answer' || q.questiontype === 'Long Answer') {
                    const answer = document.getElementById(`question${index}`);
                    hasAnswer = answer && answer.value.trim();
                    if (!hasAnswer && q.required) {
                        answer.classList.add('error');
                        error.classList.remove('hidden');
                        isValid = false;
                    } else {
                        answer.classList.remove('error');
                        error.classList.add('hidden');
                    }
                } else if (q.questiontype === 'MCQ - Single Answer') {
                    const selected = document.querySelector(`input[name="question${index}"]:checked`);
                    hasAnswer = !!selected;
                    if (!hasAnswer && q.required) {
                        error.classList.remove('hidden');
                        error.textContent = 'Please select an option';
                        isValid = false;
                    } else {
                        error.classList.add('hidden');
                    }
                } else if (q.questiontype === 'MCQ - Multiple Answers') {
                    const selected = document.querySelectorAll(`input[name="question${index}"]:checked`);
                    const count = selected.length;
                    hasAnswer = count > 0;
                    
                    if (q.required && !hasAnswer) {
                        error.textContent = 'Please select at least one option';
                        error.classList.remove('hidden');
                        isValid = false;
                    } else if (q.minallowedanswers && count < q.minallowedanswers) {
                        error.textContent = `Please select at least ${q.minallowedanswers} option(s)`;
                        error.classList.remove('hidden');
                        isValid = false;
                    } else if (q.maxallowedanswers && count > q.maxallowedanswers) {
                        error.textContent = `Please select maximum ${q.maxallowedanswers} option(s)`;
                        error.classList.remove('hidden');
                        isValid = false;
                    } else {
                        error.classList.add('hidden');
                    }
                }
            });
        }
        
        return isValid;
    }
    
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    // File Upload
    function setupFileUpload() {
        const fileUploadArea = document.getElementById('fileUploadArea');
        const resumeFile = document.getElementById('resumeFile');
        
        if (!fileUploadArea || !resumeFile) return;
        
        window.showMessage = window.frappe?.msgprint || function(msg) {
            alert(typeof msg === 'string' ? msg : msg.message || msg.title);
        };
        
        fileUploadArea.addEventListener('click', () => {
            resumeFile.click();
        });
        
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('active');
        });
        
        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('active');
        });
        
        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('active');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                resumeFile.files = files;
                handleFileSelect(files[0]);
            }
        });
        
        resumeFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }
    
    function handleFileSelect(file) {
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['application/pdf', 'application/msword', 
                             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        
        if (!allowedTypes.includes(file.type)) {
            window.showMessage('Please upload a PDF, DOC, or DOCX file');
            return;
        }
        
        if (file.size > maxSize) {
            window.showMessage('File size must be less than 5MB');
            return;
        }
        
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileInfo').classList.remove('hidden');
        document.getElementById('resumeError').classList.add('hidden');
    }
    
    window.JobApplication.removeFile = function() {
        document.getElementById('resumeFile').value = '';
        document.getElementById('fileInfo').classList.add('hidden');
    };
    
    // Final Submission - Update existing Job Applicant
    async function submitApplication() {
        try {
            // Validate applicant was created
            if (!applicantName) {
                throw new Error('Application reference missing. Please start over.');
            }
            
            if (window.frappe?.dom?.freeze) {
                frappe.dom.freeze('Submitting application...');
            } else {
                showLoadingState(true);
            }
            
            // Collect complete form data
            const formData = {
                applicant_name: applicantName, // Reference to existing applicant
                job_opening: frappe.job_application.job_opening,
                fullName: document.getElementById('fullName').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                location: document.getElementById('location').value,
                experience: document.getElementById('experience').value,
                linkedin: document.getElementById('linkedin').value,
                portfolio: document.getElementById('portfolio').value,
                salaryMin: document.getElementById('salaryMin').value,
                salaryMax: document.getElementById('salaryMax').value,
                currency: document.getElementById('currency').value,
                noticePeriod: document.getElementById('noticePeriod').value,
                answers: {},
                questions_json: {}
            };
            
            // Collect screening answers
            const jobData = window.frappe?.job_application || getJobDataFromPage();
            const questions = jobData?.questions || [];
            questions.forEach((q, index) => {
                let answer = '';
                
                if (q.questiontype === 'Short Answer' || q.questiontype === 'Long Answer') {
                    answer = document.getElementById(`question${index}`).value;
                } else if (q.questiontype === 'MCQ - Single Answer') {
                    const selected = document.querySelector(`input[name="question${index}"]:checked`);
                    answer = selected ? selected.value : '';
                } else if (q.questiontype === 'MCQ - Multiple Answers') {
                    const selected = document.querySelectorAll(`input[name="question${index}"]:checked`);
                    answer = Array.from(selected).map(s => s.value);
                }
                
                if (answer) {
                    formData.answers[index] = answer;
                    formData.questions_json[index] = q;
                }
            });
            
            // Upload resume to specific applicant
            const resumeFile = document.getElementById('resumeFile').files[0];
            if (resumeFile) {
                const resumeUrl = await uploadFile(resumeFile, applicantName);
                formData.resume_url = resumeUrl;
            }
            
            // Update application
            let response;
            if (window.frappe?.call) {
                response = await frappe.call({
                    method: 'supremusangel.www.apply.index.update_job_application',
                    args: {
                        submission: JSON.stringify(formData)
                    }
                });
            } else {
                const result = await fetch('/api/method/supremusangel.www.apply.index.update_job_application', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Frappe-CSRF-Token': getCsrfToken()
                    },
                    body: JSON.stringify({ submission: JSON.stringify(formData) })
                });
                response = { message: await result.json() };
            }
            
            if (window.frappe?.dom?.unfreeze) {
                frappe.dom.unfreeze();
            } else {
                showLoadingState(false);
            }
            
            if (response.message.success) {
                document.getElementById('confirmEmail').textContent = formData.email;
                currentStep = 5;
                updateStepDisplay();
            }
            
        } catch (error) {
            if (window.frappe?.dom?.unfreeze) {
                frappe.dom.unfreeze();
            } else {
                showLoadingState(false);
            }
            console.error('Submission error:', error);
            
            const errorMsg = error.message || 'Failed to submit application. Please try again.';
            if (window.frappe?.msgprint) {
                frappe.msgprint({
                    title: 'Submission Failed',
                    message: errorMsg,
                    indicator: 'red'
                });
            } else {
                alert('Submission Failed: ' + errorMsg);
            }
        }
    }
    
    // Helper functions
    function showLoadingState(show) {
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.disabled = show;
            nextBtn.textContent = show ? 'Submitting...' : 'Submit Application';
        }
    }
    
    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.content || '';
    }
    
    async function uploadFile(file, docname) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    let response;
                    if (window.frappe?.call) {
                        response = await frappe.call({
                            method: 'frappe.client.attach_file',
                            args: {
                                filename: file.name,
                                filedata: e.target.result,
                                doctype: 'Job Applicant',
                                docname: docname // Attach to specific applicant
                            }
                        });
                        resolve(response.message.file_url);
                    } else {
                        const result = await fetch('/api/method/frappe.client.attach_file', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Frappe-CSRF-Token': getCsrfToken()
                            },
                            body: JSON.stringify({
                                filename: file.name,
                                filedata: e.target.result,
                                doctype: 'Job Applicant',
                                docname: docname
                            })
                        });
                        const data = await result.json();
                        resolve(data.message.file_url);
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsDataURL(file);
        });
    }
    
})();
