document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");
    const inputs = document.querySelectorAll("input, textarea");
    const password = document.querySelector("input[name='password']");
    const confirmPassword = document.querySelector("input[name='confirm_password']");

    // Utility function for setting styles
    const setInputStyles = (element, borderColor, boxShadow) => {
        element.style.borderColor = borderColor;
        element.style.boxShadow = boxShadow;
    };

    // Add dynamic focus/blur effects
    inputs.forEach((input) => {
        input.addEventListener("focus", () => {
            setInputStyles(input, "#6e8efb", "0 0 6px rgba(110, 142, 251, 0.3)");
        });

        input.addEventListener("blur", () => {
            setInputStyles(input, "#ddd", "none");
        });
    });

    // Password matching validation
    if (form && password && confirmPassword) {
        form.addEventListener("submit", (e) => {
            if (password.value.trim() !== confirmPassword.value.trim()) {
                e.preventDefault();
                alert("Passwords do not match!");
                confirmPassword.focus();
                setInputStyles(confirmPassword, "#e91e63", "0 0 6px rgba(233, 30, 99, 0.4)");
            }
        });
    }

    // Clear alert styles on input change
    if (confirmPassword) {
        confirmPassword.addEventListener("input", () => {
            setInputStyles(confirmPassword, "#ddd", "none");
        });
    }

    // Optional: Smooth scroll to first invalid input on form error
    form.addEventListener("submit", (e) => {
        const firstInvalidInput = form.querySelector("input:invalid, textarea:invalid");
        if (firstInvalidInput) {
            e.preventDefault();
            firstInvalidInput.focus();
            setInputStyles(firstInvalidInput, "#e91e63", "0 0 6px rgba(233, 30, 99, 0.4)");
            alert("Please fill out the highlighted field(s) correctly!");
        }
    });
});
