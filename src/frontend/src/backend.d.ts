import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface DaySummary {
    cap: bigint;
    countApproved: bigint;
    date: string;
    icNames: Array<string>;
}
export interface SlotUsage {
    count: bigint;
    timeSlot: string;
}
export interface DailyRecord {
    cap: bigint;
    approvals: Array<ApprovalEntry>;
}
export interface ApprovalEntry {
    endHour: string;
    icName: string;
    entryId: bigint;
    timestampNs: bigint;
    startHour: string;
    managerName: string;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addApproval(icName: string, managerName: string, startHour: string, endHour: string): Promise<ApprovalEntry>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getDailyApprovals(): Promise<Array<ApprovalEntry>>;
    getDailyCap(): Promise<bigint>;
    getHistory(startDate: string | null, endDate: string | null): Promise<Array<[string, DailyRecord]>>;
    getRemainingSlots(): Promise<bigint>;
    getSlotUsage(): Promise<Array<SlotUsage>>;
    getSummary(): Promise<Array<DaySummary>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    removeApproval(entryId: bigint): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setDailyCap(cap: bigint): Promise<void>;
}
