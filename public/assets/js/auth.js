(function () {
  const api = (path, options) => fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options
  }).then(async (response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Something went wrong");
    return body;
  });

  function addStatus(form) {
    let status = form.querySelector(".auth-status");
    if (!status) {
      status = document.createElement("p");
      status.className = "auth-status";
      status.setAttribute("role", "alert");
      form.append(status);
    }
    return status;
  }

  function setStatus(form, message, isError) {
    const status = addStatus(form);
    status.textContent = message;
    status.style.color = isError ? "#c83230" : "#2f8a46";
  }

  document.querySelectorAll(".auth-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = event.submitter || form.querySelector("[type=submit]");
      submit.disabled = true;
      setStatus(form, "Signing you in...", false);
      try {
        await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            username: form.elements.username.value,
            password: form.elements.password.value
          })
        });
        window.location.href = "./dashboard.html";
      } catch (error) {
        setStatus(form, error.message, true);
        submit.disabled = false;
      }
    });
  });

  document.querySelectorAll(".register-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = event.submitter || document.querySelector('[form="' + form.id + '"][type="submit"]') || form.querySelector("[type=submit]");
      if (form.elements.password.value !== form.elements.confirmPassword.value) {
        setStatus(form, "Passwords do not match", true);
        return;
      }
      submit.disabled = true;
      setStatus(form, "Creating your account...", false);
      try {
        await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            referralCode: form.elements.referralCode?.value || "",
            username: form.elements.username.value,
            mobile: form.elements.mobile.value,
            password: form.elements.password.value
          })
        });
        window.location.href = "./dashboard.html";
      } catch (error) {
        setStatus(form, error.message, true);
        submit.disabled = false;
      }
    });
  });
  const referral = new URLSearchParams(window.location.search).get("ref");
  if (referral) document.querySelectorAll('[name="referralCode"]').forEach(input => { input.value = referral; });
})();
