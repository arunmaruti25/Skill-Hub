const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    profession: { type: String, default: "" },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    skills: { type: [String], default: [] },
    bio: { type: String, default: "" },
    profileImage: { type: String, default: "" },
    location: { type: String, default: "" },
    experience: { type: String, default: "Beginner" },
    availability: { type: String, default: "Available" },
    github: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin"], default: "user" }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);