frappe.ready(function () { // Check if first login on page load 
    frappe.call({
        method: 'supremusangel.supremus_angel.page.onboarding.onboarding.check_first_login', callback: function (r) {
            if (r.message && r.message.is_first_login) { // Redirect to onboarding page 
                window.location.href = '/app/onboarding';
            }
        }
    });
});