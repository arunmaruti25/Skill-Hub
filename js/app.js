/**
 * Skill Hub - Main Application Helpers & UI Logic (app.js)
 */

// ================= PASSWORD TOGGLE HELPER =================
function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = button.querySelector("i");
    const isPass = input.type === "password";
    input.type = isPass ? "text" : "password";
    if (icon) {
        icon.classList.toggle("fa-eye", !isPass);
        icon.classList.toggle("fa-eye-slash", isPass);
    }
}

// ================= PROFILE MANAGEMENT =================
let profileSkillsList = [];

function renderProfileSkills() {
    const container = document.getElementById("profileSkills") || document.getElementById("skillsTags");
    if (!container) return;
    container.innerHTML = "";
    profileSkillsList.forEach((skill, index) => {
        const tag = document.createElement("span");
        tag.innerHTML = `${skill} <button type="button" onclick="removeProfileSkill(${index})" style="border:none;background:none;cursor:pointer;color:inherit;font-weight:bold;margin-left:4px;">&times;</button>`;
        container.appendChild(tag);
    });
}

function addProfileSkill(skill) {
    const trimmed = (skill || "").trim();
    if (trimmed && !profileSkillsList.includes(trimmed)) {
        profileSkillsList.push(trimmed);
        renderProfileSkills();
    }
}

function removeProfileSkill(index) {
    profileSkillsList.splice(index, 1);
    renderProfileSkills();
}

async function loadFullProfile() {
    const user = getAuthUser();
    const userId = user.id || user._id;
    if (!userId) return;

    try {
        const res = await authFetch(`/api/profile/${userId}`);
        if (!res || !res.ok) {
            console.error("Could not fetch profile from server");
            return;
        }

        const data = await res.json();
        setAuthSession(getAuthToken(), data);

        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ""; };

        setVal("profileNameInput", data.name);
        setVal("editName", data.name);
        setVal("professionInput", data.profession);
        setVal("profileRole", data.profession || "Developer");
        setVal("profileLocationInput", data.location);
        setVal("profileBioInput", data.bio);
        setVal("editBio", data.bio);
        setVal("editEmail", data.email);
        setVal("experienceInput", data.experience || "Beginner");
        setVal("availabilityInput", data.availability || "Available");
        setVal("githubInput", data.github);
        setVal("linkedinInput", data.linkedin);

        setText("profileTitle", data.name || "User");
        setText("profileName", data.name || "User");
        setText("profileProfession", data.profession || data.role || "Developer");
        setText("profileRole", data.profession || data.role || "Developer");
        setText("profileLocation", data.location || "");

        const joinDateEl = document.getElementById("joinDate");
        if (joinDateEl) {
            joinDateEl.textContent = data.createdAt
                ? new Date(data.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                : "Recently";
        }

        profileSkillsList = Array.isArray(data.skills) ? [...data.skills] : [];
        renderProfileSkills();

        const avatar = document.getElementById("profileAvatar");
        const removeBtn = document.getElementById("removeImageBtn");
        if (avatar) {
            if (data.profileImage) {
                avatar.innerHTML = `<img src="${data.profileImage.startsWith('http') ? data.profileImage : API_BASE_URL + data.profileImage}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            } else {
                avatar.textContent = (data.name || "U").charAt(0).toUpperCase();
            }
        }
        if (removeBtn) {
            removeBtn.style.display = data.profileImage ? "inline-flex" : "none";
        }
    } catch (err) {
        console.error("loadFullProfile error:", err);
    }
}

async function saveFullProfile() {
    const user = getAuthUser();
    const userId = user.id || user._id;
    if (!userId) return showToast("Please log in again.", "error");

    const getVal = (id) => document.getElementById(id)?.value?.trim() || "";

    const name = getVal("profileNameInput") || getVal("editName") || user.name;
    const profession = getVal("professionInput") || getVal("profileRole");
    const location = getVal("profileLocationInput");
    const bio = getVal("profileBioInput") || getVal("editBio");
    const experience = document.getElementById("experienceInput")?.value || "Beginner";
    const availability = document.getElementById("availabilityInput")?.value || "Available";
    const github = getVal("githubInput");
    const linkedin = getVal("linkedinInput");

    const profileData = {
        name,
        profession,
        location,
        bio,
        skills: profileSkillsList,
        experience,
        availability,
        github,
        linkedin
    };

    try {
        const res = await authFetch(`/api/profile/${userId}`, {
            method: "PUT",
            body: JSON.stringify(profileData)
        });

        if (res && res.ok) {
            const data = await res.json();
            setAuthSession(getAuthToken(), data.user);
            showToast("Profile saved successfully!", "success");
            setTimeout(() => {
                const isInsidePages = window.location.pathname.includes("/pages/");
                window.location.href = isInsidePages ? "dashboard.html" : "pages/dashboard.html";
            }, 600);
        } else {
            const errData = res ? await res.json() : {};
            showToast(errData.message || "Failed to save profile.", "error");
        }
    } catch (err) {
        showToast("Network error. Could not save profile.", "error");
    }
}

// Image upload setup
function initProfileImageHandlers() {
    const imageInput = document.getElementById("profileImageInput");
    if (!imageInput) return;

    imageInput.addEventListener("change", async function () {
        const file = this.files[0];
        const user = getAuthUser();
        const userId = user.id || user._id;
        if (!file || !userId) return;

        // Preview immediately
        const reader = new FileReader();
        reader.onload = () => {
            const avatar = document.getElementById("profileAvatar");
            if (avatar) avatar.innerHTML = `<img src="${reader.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        };
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append("image", file);

        try {
            const res = await authFetch(`/api/profile/${userId}/image`, {
                method: "POST",
                body: formData
            });

            if (res && res.ok) {
                const data = await res.json();
                setAuthSession(getAuthToken(), data.user);
                showToast("Profile photo updated!", "success");
                const removeBtn = document.getElementById("removeImageBtn");
                if (removeBtn) removeBtn.style.display = "inline-flex";
            } else {
                const err = res ? await res.json() : {};
                showToast(err.message || "Image upload failed.", "error");
            }
        } catch (err) {
            showToast("Failed to upload image.", "error");
        }
    });
}

async function removeProfileImage() {
    const user = getAuthUser();
    const userId = user.id || user._id;
    if (!userId) return;
    if (!confirm("Are you sure you want to remove your profile photo?")) return;

    try {
        const res = await authFetch(`/api/profile/${userId}/image`, { method: "DELETE" });
        if (res && res.ok) {
            const data = await res.json();
            setAuthSession(getAuthToken(), data.user);
            const avatar = document.getElementById("profileAvatar");
            if (avatar) avatar.textContent = (user.name || "U").charAt(0).toUpperCase();
            const removeBtn = document.getElementById("removeImageBtn");
            if (removeBtn) removeBtn.style.display = "none";
            const fileInput = document.getElementById("profileImageInput");
            if (fileInput) fileInput.value = "";
            showToast("Profile photo removed.", "success");
        } else {
            showToast("Failed to remove photo.", "error");
        }
    } catch (err) {
        showToast("Network error.", "error");
    }
}

// Skill enter key event listener
document.addEventListener("DOMContentLoaded", () => {
    const skillInput = document.getElementById("skillInput");
    if (skillInput) {
        skillInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                addProfileSkill(this.value);
                this.value = "";
            }
        });
    }

    initProfileImageHandlers();

    if (document.getElementById("profileNameInput") || document.getElementById("editName")) {
        loadFullProfile();
    }
});