import bcrypt from "bcrypt";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    }, username: {
        type: String,
        required: true,
        unique: true,
    }, password: {
        type: String,
        required: true
    }
}, { timestamps: true });

userSchema.pre("save", async function savePassword() {
    if (!this.isModified("password")) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('user', userSchema);

export default User;
