const mongoose = require("mongoose");

const joinRequestSchema = new mongoose.Schema({
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["request", "invite"], default: "request" },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" }
}, { timestamps: true });

module.exports = mongoose.model("JoinRequest", joinRequestSchema);