// ================= CONFIGURATION =================
const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:5000"
    : "http://127.0.0.1:5000"; // Replace with your live backend URL on Render/Railway when deployed

// ================= AUTH (REGISTER & LOGIN) =================
const registerForm = document.getElementById("registerForm");
if (registerForm) {
    registerForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (password.length < 6) return alert("Password must be at least 6 characters long!");
        if (password !== confirmPassword) return alert("Passwords do not match!");

        try {
            const res = await fetch(`${API_BASE_URL}/api/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();
            if (res.ok) {
                alert("Account created successfully!");
                window.location.href = "login.html";
            } else {
                alert(data.message || "Registration failed");
            }
        } catch {
            alert("Cannot connect to the server.");
        }
    });
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        try {
            const res = await fetch(`${API_BASE_URL}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem("loggedIn", "true");
                localStorage.setItem("user", JSON.stringify(data.user));
                window.location.href = "dashboard.html";
            } else {
                alert(data.message || "Login failed");
            }
        } catch {
            alert("Cannot connect to the server.");
        }
    });
}

function togglePassword(id, button) {
    const input = document.getElementById(id);
    const icon = button.querySelector("i");
    const isPass = input.type === "password";
    input.type = isPass ? "text" : "password";
    icon.classList.toggle("fa-eye", !isPass);
    icon.classList.toggle("fa-eye-slash", isPass);
}

function logout() {
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("user");
    window.location.href = "../index.html";
}

// ================= PROFILE =================
let profileSkills = [];

async function loadProfile() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user?.id) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/profile/` + user.id);
        const data = await res.json();
        if (!res.ok) return alert(data.message || "Could not load profile");

        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        setVal("profileNameInput", data.name || "");
        setVal("professionInput", data.profession || "");
        setVal("profileLocationInput", data.location || "");
        setVal("profileBioInput", data.bio || "");
        setVal("experienceInput", data.experience || "Beginner");
        setVal("availabilityInput", data.availability || "Available");
        setVal("githubInput", data.github || "");
        setVal("linkedinInput", data.linkedin || "");

        profileSkills = data.skills || [];
        displaySkills();

        setText("profileTitle", data.name || "User");
        setText("profileProfession", data.profession || "");
        setText("profileLocation", data.location || "");

        const avatar = document.getElementById("profileAvatar");
        const removeBtn = document.getElementById("removeImageBtn");
        if (avatar) {
            avatar.innerHTML = data.profileImage
                ? `<img src="${API_BASE_URL}${data.profileImage}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                : (data.name || "U").charAt(0).toUpperCase();
        }
        if (removeBtn) {
            removeBtn.style.display = data.profileImage ? "inline-flex" : "none";
        }
    } catch {
        alert("Cannot connect to the server.");
    }
}

function displaySkills() {
    const container = document.getElementById("profileSkills");
    if (!container) return;
    container.innerHTML = "";
    profileSkills.forEach((skill, index) => {
        const tag = document.createElement("span");
        tag.innerHTML = `${skill} <button onclick="removeSkill(${index})" style="border:none;background:none;cursor:pointer;">×</button>`;
        container.appendChild(tag);
    });
}

const skillInput = document.getElementById("skillInput");
if (skillInput) {
    skillInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            const skill = skillInput.value.trim();
            if (skill && !profileSkills.includes(skill)) {
                profileSkills.push(skill);
                skillInput.value = "";
                displaySkills();
            }
        }
    });
}

function removeSkill(index) {
    profileSkills.splice(index, 1);
    displaySkills();
}

async function saveProfile() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user?.id) return alert("Please login again.");

    const profileData = {
        name: document.getElementById("profileNameInput")?.value.trim() || "",
        profession: document.getElementById("professionInput")?.value.trim() || "",
        location: document.getElementById("profileLocationInput")?.value.trim() || "",
        bio: document.getElementById("profileBioInput")?.value.trim() || "",
        skills: profileSkills,
        experience: document.getElementById("experienceInput")?.value || "Beginner",
        availability: document.getElementById("availabilityInput")?.value || "Available",
        github: document.getElementById("githubInput")?.value.trim() || "",
        linkedin: document.getElementById("linkedinInput")?.value.trim() || ""
    };

    try {
        const res = await fetch(`${API_BASE_URL}/api/profile/` + user.id, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(profileData)
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem("user", JSON.stringify({ id: data.user._id, name: data.user.name, email: data.user.email }));
            const setTitle = document.getElementById("profileTitle");
            if (setTitle) setTitle.textContent = data.user.name;
            const setProf = document.getElementById("profileProfession");
            if (setProf) setProf.textContent = data.user.profession || "";
            const avatar = document.getElementById("profileAvatar");
            if (avatar && !data.user.profileImage) avatar.textContent = data.user.name.charAt(0).toUpperCase();
            alert("Profile saved successfully!");
        } else {
            alert(data.message || "Failed to save profile");
        }
    } catch {
        alert("Cannot connect to the server.");
    }
}

if (document.getElementById("profileNameInput")) loadProfile();

const profileImageInput = document.getElementById("profileImageInput");
if (profileImageInput) {
    profileImageInput.addEventListener("change", async function () {
        const file = this.files[0];
        const user = JSON.parse(localStorage.getItem("user"));
        if (!file || !user?.id) return;

        const reader = new FileReader();
        reader.onload = () => {
            const avatar = document.getElementById("profileAvatar");
            if (avatar) avatar.innerHTML = `<img src="${reader.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        };
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append("image", file);

        const res = await fetch(`${API_BASE_URL}/api/profile/${user.id}/image`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            const removeBtn = document.getElementById("removeImageBtn");
            if (removeBtn) removeBtn.style.display = "inline-flex";
        } else {
            alert(data.message || "Image upload failed");
        }
    });
}

async function removeProfileImage() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user?.id) return;
    if (!confirm("Are you sure you want to remove your profile photo?")) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/profile/${user.id}/image`, {
            method: "DELETE"
        });
        const data = await res.json();
        if (res.ok) {
            const avatar = document.getElementById("profileAvatar");
            if (avatar) avatar.textContent = (user.name || "U").charAt(0).toUpperCase();
            const removeBtn = document.getElementById("removeImageBtn");
            if (removeBtn) removeBtn.style.display = "none";
            const fileInput = document.getElementById("profileImageInput");
            if (fileInput) fileInput.value = "";
            alert("Profile image removed successfully!");
        } else {
            alert(data.message || "Failed to remove image");
        }
    } catch {
        alert("Cannot connect to the server.");
    }
}

// ================= NOTIFICATIONS =================
async function markAllRead() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.id) {
        try {
            await fetch(`${API_BASE_URL}/api/notifications/read-all/` + user.id, { method: "PUT" });
        } catch (err) {
            console.error("Could not mark notifications as read:", err);
        }
    }

    document.querySelectorAll(".notification.unread").forEach(n => n.classList.remove("unread"));
    const button = document.getElementById("markReadBtn");
    if (button) {
        button.innerHTML = '<i class="fa-solid fa-check"></i> All Read';
        button.disabled = true;
    }
    updateSidebarBadges();
}

// ================= GLOBAL SIDEBAR BADGES =================
async function updateSidebarBadges() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user?.id) return;

    try {
        const msgRes = await fetch(`${API_BASE_URL}/api/message-inbox/` + user.id);
        if (msgRes.ok) {
            const conversations = await msgRes.json();
            const unreadMessages = conversations.reduce((sum, c) => sum + Number(c.unreadCount || 0), 0);
            document.querySelectorAll("#messageBadge, .message-badge, .sidebar-message-badge").forEach(badge => {
                badge.textContent = unreadMessages;
                badge.style.display = unreadMessages > 0 ? "flex" : "none";
            });
        }
    } catch (err) {
        console.error("Error updating message badge:", err);
    }

    try {
        const notifRes = await fetch(`${API_BASE_URL}/api/notifications/` + user.id);
        if (notifRes.ok) {
            const notifs = await notifRes.json();
            const unreadNotifs = notifs.filter(n => !n.read).length;
            document.querySelectorAll("#notificationBadge, .notification-badge, .sidebar-notification-badge").forEach(badge => {
                badge.textContent = unreadNotifs;
                badge.style.display = unreadNotifs > 0 ? "flex" : "none";
            });
        }
    } catch (err) {
        console.error("Error updating notification badge:", err);
    }
}

function checkAdminAccess() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.role === "admin") {
        const nav = document.querySelector(".sidebar nav");
        if (nav && !document.getElementById("adminNavBtn")) {
            const link = document.createElement("a");
            link.id = "adminNavBtn";
            link.href = "admin.html";
            if (window.location.pathname.includes("admin.html")) link.className = "active";
            link.innerHTML = '<i class="fa-solid fa-shield-halved" style="color:var(--c-sky);"></i> Admin Panel';
            nav.appendChild(link);
        }
    }
}

checkAdminAccess();
updateSidebarBadges();
setInterval(updateSidebarBadges, 5000);