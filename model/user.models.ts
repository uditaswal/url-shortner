import bcrypt from "bcrypt";
import mongoose from "mongoose";

interface UserMethods {
    comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface UserFields {
    name: string;
    username: string;
    password: string;
    isAdmin: boolean;
    tokenVersion: number;
}

const userSchema = new mongoose.Schema<
    UserFields,
    mongoose.Model<UserFields, Record<string, never>, UserMethods>,
    UserMethods
>(
    {
        name: {
            type: String,
            required: true
        },
        username: {
            type: String,
            required: true,
            unique: true
        },
        password: {
            type: String,
            required: true
        },
        isAdmin: {
            type: Boolean,
            default: false
        },
        tokenVersion: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

userSchema.pre("save", async function savePassword() {
    if (!this.isModified("password")) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model<
    UserFields,
    mongoose.Model<UserFields, Record<string, never>, UserMethods>
>("user", userSchema);

export default User;
