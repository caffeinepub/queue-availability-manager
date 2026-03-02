import Map "mo:core/Map";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import List "mo:core/List";
import Principal "mo:core/Principal";

actor {
  let nanosecondToSeconds = 1_000_000_000;
  let sessionExpiryNs : Int = 86_400_000_000_000;

  let validHours = [
    "7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM",
    "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM",
  ];

  let displayPeriods = [
    "7 AM - 8 AM", "8 AM - 9 AM", "9 AM - 10 AM", "10 AM - 11 AM",
    "11 AM - 12 PM", "12 PM - 1 PM", "1 PM - 2 PM", "2 PM - 3 PM",
    "3 PM - 4 PM", "4 PM - 5 PM", "5 PM - 6 PM", "6 PM - 7 PM",
  ];

  // ── Public types ──────────────────────────────────────────────────────────
  public type UserRole = { #admin; #user; #guest };
  public type UserProfile = { name : Text };
  public type UserInfo = { userId : Nat; name : Text; role : UserRole };

  public type ApprovalEntry = {
    entryId : Nat;
    icName : Text;
    managerName : Text;
    timestampNs : Int;
    startHour : Text;
    endHour : Text;
    exclusionDate : Text;
    createdByUserId : Nat;
  };

  public type DailyRecord = { cap : Nat; approvals : [ApprovalEntry] };
  public type DaySummary = { date : Text; cap : Nat; countApproved : Nat; icNames : [Text] };
  public type SlotUsage = { timeSlot : Text; count : Nat };
  public type SlotUsageWithLimit = { timeSlot : Text; count : Nat; limit : Nat };
  public type HourlyLimit = { periodIndex : Nat; limit : Nat };

  // ── Private types ─────────────────────────────────────────────────────────
  type R<T, E> = { #ok : T; #err : E };
  type Credential = { userId : Nat; passwordHash : Text };
  type Session = { userId : Nat; createdAtNs : Int };

  // ── Old stable variable types (kept for upgrade compatibility) ────────────
  // These accept the old stable state so the canister upgrade doesn't fail.
  // They are not used in any logic below.
  type OldUserRole = { #admin; #user; #guest };
  type OldApprovalEntry = {
    entryId : Nat; icName : Text; managerName : Text; timestampNs : Int;
    startHour : Text; endHour : Text; exclusionDate : Text; createdBy : Principal;
  };
  type OldDailyRecord = { cap : Nat; approvals : [OldApprovalEntry] };
  type OldState = {
    var lastUpdateNs : Int;
    var dailyCap : Nat;
    var dailyApprovals : List.List<OldApprovalEntry>;
    var lastAssignedId : Nat;
  };
  type OldAccessControlState = {
    var adminAssigned : Bool;
    userRoles : Map.Map<Principal, OldUserRole>;
  };

  // ── Old stable variables (accepted, will hold old values on upgrade) ──────
  // Variable names must match the OLD actor exactly.
  let weekdayOffset : Nat = 1;
  let defaultDailyCap : Nat = 50;
  let accessControlState : OldAccessControlState = {
    var adminAssigned = false;
    userRoles = Map.empty<Principal, OldUserRole>();
  };
  var state : OldState = {
    var lastUpdateNs = Time.now();
    var dailyCap = 50;
    var dailyApprovals = List.empty<OldApprovalEntry>();
    var lastAssignedId = 0;
  };
  // historyStore and userProfiles need their OLD types here for upgrade compat,
  // but we also need NEW versions with new types. We use different names below.
  let historyStore = Map.empty<Text, OldDailyRecord>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  var adminAssigned : Bool = false;
  let hourlyLimits = Map.empty<Nat, Nat>();

  // ── New stable variables (all use "new" prefix to avoid name collision) ────
  var newAdminAssigned : Bool = false;
  var newUserIdCounter : Nat = 0;
  var newTokenCounter : Nat = 0;
  let newCredentials = Map.empty<Text, Credential>();
  let newUserProfiles = Map.empty<Nat, UserProfile>();
  let newUserRoles = Map.empty<Nat, UserRole>();
  let newSessionTokens = Map.empty<Text, Session>();
  let newHistoryStore = Map.empty<Text, DailyRecord>();
    let newDailyApprovals = List.empty<ApprovalEntry>();
  var newLastAssignedId : Nat = 0;
  var newDailyCap : Nat = 50;
  var newLastUpdateNs : Int = Time.now();

  // ── Password Hashing ──────────────────────────────────────────────────────
  func hashPassword(password : Text) : Text {
    var h : Nat = 5381;
    for (c in password.chars()) {
      h := (h * 33 + c.toNat32().toNat()) % 4294967296;
    };
    h.toText();
  };

  // ── Token Generation ──────────────────────────────────────────────────────
  func generateToken(userId : Nat) : Text {
    newTokenCounter += 1;
    let t = Int.abs(Time.now());
    let combined = (userId * 1000003 + t % 999983 + newTokenCounter * 7919) % 999999999999;
    userId.toText() # "-" # combined.toText() # "-" # newTokenCounter.toText();
  };

  // ── Session Validation ────────────────────────────────────────────────────
  func validateSession(token : Text) : ?Nat {
    switch (newSessionTokens.get(token)) {
      case (null) { null };
      case (?session) {
        if (Time.now() - session.createdAtNs > sessionExpiryNs) {
          newSessionTokens.remove(token);
          null;
        } else {
          ?session.userId;
        };
      };
    };
  };

  func getUserRole(userId : Nat) : UserRole {
    switch (newUserRoles.get(userId)) {
      case (?role) { role };
      case (null) { #guest };
    };
  };

  func requireUser(token : Text) : Nat {
    let userId = switch (validateSession(token)) {
      case (null) { Runtime.trap("Unauthorized: Invalid or expired session") };
      case (?uid) { uid };
    };
    switch (newUserRoles.get(userId)) {
      case (?#guest) { Runtime.trap("Unauthorized: Member access required. Your account may be pending approval.") };
      case (null) { Runtime.trap("Unauthorized: Member access required.") };
      case (_) { userId };
    };
  };

  func requireAdmin(token : Text) : Nat {
    let userId = switch (validateSession(token)) {
      case (null) { Runtime.trap("Unauthorized: Invalid or expired session") };
      case (?uid) { uid };
    };
    switch (newUserRoles.get(userId)) {
      case (?#admin) { userId };
      case (_) { Runtime.trap("Unauthorized: Admin access required") };
    };
  };

  // ── Date Helpers ──────────────────────────────────────────────────────────
  func isLeapYear(year : Int) : Bool {
    if (year % 400 == 0) { return true };
    if (year % 100 == 0) { return false };
    if (year % 4 == 0) { return true };
    false;
  };

  func daysInMonth(month : Int, year : Int) : Int {
    switch (month) {
      case (1) { 31 };
      case (2) { if (isLeapYear(year)) { 29 } else { 28 } };
      case (3) { 31 };
      case (4) { 30 };
      case (5) { 31 };
      case (6) { 30 };
      case (7) { 31 };
      case (8) { 31 };
      case (9) { 30 };
      case (10) { 31 };
      case (11) { 30 };
      case (12) { 31 };
      case (_) { 0 };
    };
  };

  func padZero(n : Int) : Text {
    if (n < 10) { "0" # n.toText() } else { n.toText() };
  };

  func nanosecondsToDateString(nanoseconds : Int) : Text {
    let totalSeconds = nanoseconds / nanosecondToSeconds;
    var days = totalSeconds / 86400;
    var year : Int = 1970;
    var daysInYear : Int = if (isLeapYear(year)) { 366 } else { 365 };
    while (days >= daysInYear) {
      days -= daysInYear;
      year += 1;
      daysInYear := if (isLeapYear(year)) { 366 } else { 365 };
    };
    var month : Int = 1;
    var daysInCurrentMonth : Int = daysInMonth(month, year);
    while (days >= daysInCurrentMonth) {
      days -= daysInCurrentMonth;
      month += 1;
      daysInCurrentMonth := daysInMonth(month, year);
    };
    let day = days + 1;
    year.toText() # "-" # padZero(month) # "-" # padZero(day);
  };

  func compareDateStrings(date1 : Text, date2 : Text) : Order.Order {
    Text.compare(date1, date2);
  };

  func findHourIndex(hour : Text) : ?Nat {
    validHours.indexOf(hour);
  };

  // ── Daily Reset ───────────────────────────────────────────────────────────
  func checkAndResetDay() {
    let today = nanosecondsToDateString(Time.now());
    let lastRecordedDay = nanosecondsToDateString(newLastUpdateNs);
    if (today != lastRecordedDay) {
      let approvalsArray = newDailyApprovals.toArray();
      let archivedApprovals = approvalsArray.filter(func(e : ApprovalEntry) : Bool { e.exclusionDate == lastRecordedDay });
      let archivedDay : DailyRecord = { cap = newDailyCap; approvals = archivedApprovals };
      newHistoryStore.add(lastRecordedDay, archivedDay);
      let futureEntries = approvalsArray.filter(func(e : ApprovalEntry) : Bool { compareDateStrings(e.exclusionDate, today) == #greater });
      newDailyApprovals.clear();
      for (entry in futureEntries.vals()) { newDailyApprovals.add(entry) };
      newLastUpdateNs := Time.now();
    };
  };

  // ── Slot Usage ────────────────────────────────────────────────────────────
  func getSlotUsageInternal() : [SlotUsage] {
    let today = nanosecondsToDateString(Time.now());
    let approvalsArray = newDailyApprovals.toArray().filter(func(e : ApprovalEntry) : Bool { e.exclusionDate == today });
    let results = List.empty<SlotUsage>();
    var i : Nat = 0;
    for (period in displayPeriods.vals()) {
      let idx = i;
      let count = approvalsArray.filter(func(entry : ApprovalEntry) : Bool {
        switch (findHourIndex(entry.startHour), findHourIndex(entry.endHour)) {
          case (?s, ?e) { s <= idx and e > idx };
          case (_) { false };
        };
      }).size();
      results.add({ timeSlot = period; count });
      i += 1;
    };
    results.toArray();
  };

  // ── Auth Endpoints ────────────────────────────────────────────────────────
  public shared func register(username : Text, password : Text) : async R<Nat, Text> {
    if (username.size() < 3) { return #err("Username must be at least 3 characters") };
    if (password.size() < 6) { return #err("Password must be at least 6 characters") };
    switch (newCredentials.get(username)) {
      case (?_) { return #err("Username already taken") };
      case (null) {};
    };
    let userId = newUserIdCounter;
    newUserIdCounter += 1;
    newCredentials.add(username, { userId; passwordHash = hashPassword(password) });
    newUserProfiles.add(userId, { name = username });
    if (not newAdminAssigned) {
      newUserRoles.add(userId, #admin);
      newAdminAssigned := true;
    } else {
      newUserRoles.add(userId, #guest);
    };
    #ok(userId);
  };

  public shared func login(username : Text, password : Text) : async R<Text, Text> {
    switch (newCredentials.get(username)) {
      case (null) { #err("Invalid username or password") };
      case (?cred) {
        if (cred.passwordHash != hashPassword(password)) {
          return #err("Invalid username or password");
        };
        let token = generateToken(cred.userId);
        newSessionTokens.add(token, { userId = cred.userId; createdAtNs = Time.now() });
        #ok(token);
      };
    };
  };

  public shared func logout(sessionToken : Text) : async () {
    newSessionTokens.remove(sessionToken);
  };

  public query func whoami(sessionToken : Text) : async R<UserInfo, Text> {
    switch (validateSession(sessionToken)) {
      case (null) { #err("Invalid or expired session") };
      case (?userId) {
        let name = switch (newUserProfiles.get(userId)) { case (?p) { p.name }; case (null) { "" } };
        #ok({ userId; name; role = getUserRole(userId) });
      };
    };
  };

  // ── User Profile Endpoints ────────────────────────────────────────────────
  public query func getCallerUserProfile(sessionToken : Text) : async ?UserProfile {
    switch (validateSession(sessionToken)) {
      case (null) { null };
      case (?userId) { newUserProfiles.get(userId) };
    };
  };

  public query func getCallerUserId(sessionToken : Text) : async ?Nat {
    validateSession(sessionToken);
  };

  public query func isCallerAdmin(sessionToken : Text) : async Bool {
    switch (validateSession(sessionToken)) {
      case (null) { false };
      case (?userId) { getUserRole(userId) == #admin };
    };
  };

  public query func listAllUsers(sessionToken : Text) : async [UserInfo] {
    let _ = requireAdmin(sessionToken);
    let result = List.empty<UserInfo>();
    for ((uid, profile) in newUserProfiles.entries()) {
      result.add({ userId = uid; name = profile.name; role = getUserRole(uid) });
    };
    result.toArray();
  };

  public shared func setUserRole(sessionToken : Text, targetUserId : Nat, role : UserRole) : async R<(), Text> {
    switch (validateSession(sessionToken)) {
      case (null) { #err("Unauthorized: Invalid or expired session") };
      case (?userId) {
        if (getUserRole(userId) != #admin) { return #err("Unauthorized: Admin access required") };
        newUserRoles.add(targetUserId, role);
        #ok(());
      };
    };
  };

  public shared func deleteUser(sessionToken : Text, targetUserId : Nat) : async R<(), Text> {
    switch (validateSession(sessionToken)) {
      case (null) { #err("Unauthorized: Invalid or expired session") };
      case (?userId) {
        if (getUserRole(userId) != #admin) { return #err("Unauthorized: Admin access required") };
        if (userId == targetUserId) { return #err("Admins cannot delete themselves") };
        if (not newUserProfiles.containsKey(targetUserId)) { return #err("User does not exist") };
        newUserProfiles.remove(targetUserId);
        newUserRoles.remove(targetUserId);
        let tokensToRemove = List.empty<Text>();
        for ((tok, session) in newSessionTokens.entries()) {
          if (session.userId == targetUserId) { tokensToRemove.add(tok) };
        };
        for (tok in tokensToRemove.values()) { newSessionTokens.remove(tok) };
        #ok(());
      };
    };
  };

  // ── Queue Approvals ───────────────────────────────────────────────────────
  public shared func addApproval(sessionToken : Text, icName : Text, managerName : Text, startHour : Text, endHour : Text, exclusionDate : Text) : async R<ApprovalEntry, Text> {
    let userId = switch (validateSession(sessionToken)) {
      case (null) { return #err("Unauthorized: Invalid or expired session") };
      case (?uid) { uid };
    };
    if (getUserRole(userId) == #guest) {
      return #err("Unauthorized: Member access required. Your account may be pending approval.");
    };
    checkAndResetDay();
    let startIndex = switch (findHourIndex(startHour)) {
      case (null) { return #err("Invalid start hour: " # startHour) };
      case (?idx) { idx };
    };
    let endIndex = switch (findHourIndex(endHour)) {
      case (null) { return #err("Invalid end hour: " # endHour) };
      case (?idx) { idx };
    };
    if (endIndex <= startIndex) { return #err("End hour must be later than start hour") };
    let approvalsArray = newDailyApprovals.toArray();
    var pi : Nat = startIndex;
    while (pi < endIndex) {
      let periodIdx = pi;
      let periodCount = approvalsArray.filter(func(entry : ApprovalEntry) : Bool {
        if (entry.exclusionDate != exclusionDate) { return false };
        switch (findHourIndex(entry.startHour), findHourIndex(entry.endHour)) {
          case (?s, ?e) { s <= periodIdx and e > periodIdx };
          case (_) { false };
        };
      }).size();
      let periodLimit = switch (hourlyLimits.get(periodIdx)) { case (?l) { l }; case (null) { 10 } };
      if (periodCount >= periodLimit) {
        return #err("Period " # periodIdx.toText() # " is full for " # exclusionDate);
      };
      pi += 1;
    };
    for (entry in approvalsArray.vals()) {
      if (Text.equal(entry.icName, icName) and entry.exclusionDate == exclusionDate) {
        let entryStart = switch (findHourIndex(entry.startHour)) { case (?idx) { idx }; case (null) { 0 } };
        let entryEnd = switch (findHourIndex(entry.endHour)) { case (?idx) { idx }; case (null) { 0 } };
        if (startIndex < entryEnd and endIndex > entryStart) {
          return #err(icName # " already has an approved exclusion that overlaps that time range (" # entry.startHour # " - " # entry.endHour # ") for " # exclusionDate);
        };
      };
    };
    let newEntry : ApprovalEntry = {
      entryId = newLastAssignedId;
      icName;
      managerName;
      timestampNs = Time.now();
      startHour;
      endHour;
      exclusionDate;
      createdByUserId = userId;
    };
    newDailyApprovals.add(newEntry);
    newLastAssignedId += 1;
    #ok(newEntry);
  };

  public shared func removeApproval(sessionToken : Text, entryId : Nat) : async R<(), Text> {
    let userId = switch (validateSession(sessionToken)) {
      case (null) { return #err("Unauthorized: Invalid or expired session") };
      case (?uid) { uid };
    };
    if (getUserRole(userId) == #guest) {
      return #err("Unauthorized: Member access required.");
    };
    let approvalsArray = newDailyApprovals.toArray();
    let matching = approvalsArray.filter(func(e : ApprovalEntry) : Bool { e.entryId == entryId });
    if (matching.size() == 0) {
      return #err("No entry found with id " # entryId.toText());
    };
    let isAdminUser = getUserRole(userId) == #admin;
    let isOwner = matching[0].createdByUserId == userId;
    if (not (isOwner or isAdminUser)) {
      return #err("Unauthorized: Only the creator or an admin can remove this approval");
    };
    let filtered = approvalsArray.filter(func(e : ApprovalEntry) : Bool { e.entryId != entryId });
    newDailyApprovals.clear();
    for (entry in filtered.vals()) { newDailyApprovals.add(entry) };
    checkAndResetDay();
    #ok(());
  };

  public query func getDailyApprovals(sessionToken : Text) : async [ApprovalEntry] {
    let _ = requireUser(sessionToken);
    let today = nanosecondsToDateString(Time.now());
    newDailyApprovals.toArray().filter(func(e : ApprovalEntry) : Bool { e.exclusionDate == today });
  };

  public query func getFutureApprovals(sessionToken : Text) : async [ApprovalEntry] {
    let _ = requireUser(sessionToken);
    let today = nanosecondsToDateString(Time.now());
    newDailyApprovals.toArray().filter(func(e : ApprovalEntry) : Bool { compareDateStrings(e.exclusionDate, today) == #greater });
  };

  public query func getRemainingSlots(sessionToken : Text) : async Nat {
    let _ = requireUser(sessionToken);
    let today = nanosecondsToDateString(Time.now());
    let todayApprovals = newDailyApprovals.toArray().filter(func(e : ApprovalEntry) : Bool { e.exclusionDate == today });
    if (todayApprovals.size() >= newDailyCap) { return 0 };
    newDailyCap - todayApprovals.size();
  };

  public query func getSlotUsage(sessionToken : Text) : async [SlotUsage] {
    let _ = requireUser(sessionToken);
    getSlotUsageInternal();
  };

  public query func getSlotUsageWithLimits(sessionToken : Text) : async [SlotUsageWithLimit] {
    let _ = requireUser(sessionToken);
    let slotUsages = getSlotUsageInternal();
    let results = List.empty<SlotUsageWithLimit>();
    for (slot in slotUsages.vals()) {
      let periodIndex = switch (displayPeriods.indexOf(slot.timeSlot)) { case (?idx) { idx }; case (null) { 0 } };
      let limit = switch (hourlyLimits.get(periodIndex)) { case (?l) { l }; case (null) { 10 } };
      results.add({ timeSlot = slot.timeSlot; count = slot.count; limit });
    };
    results.toArray();
  };

  // ── Config ────────────────────────────────────────────────────────────────
  public query func getDailyCap(sessionToken : Text) : async Nat {
    let _ = requireUser(sessionToken);
    newDailyCap;
  };

  public shared func setDailyCap(sessionToken : Text, cap : Nat) : async R<(), Text> {
    switch (validateSession(sessionToken)) {
      case (null) { #err("Unauthorized: Invalid or expired session") };
      case (?userId) {
        if (getUserRole(userId) != #admin) { return #err("Unauthorized: Admin access required") };
        checkAndResetDay();
        newDailyCap := cap;
        #ok(());
      };
    };
  };

  public query func getHourlyLimits(sessionToken : Text) : async [HourlyLimit] {
    let _ = requireUser(sessionToken);
    let results = List.empty<HourlyLimit>();
    for ((periodIndex, limit) in hourlyLimits.entries()) {
      results.add({ periodIndex; limit });
    };
    results.toArray();
  };

  public shared func setHourlyLimit(sessionToken : Text, periodIndex : Nat, limit : Nat) : async R<(), Text> {
    switch (validateSession(sessionToken)) {
      case (null) { #err("Unauthorized: Invalid or expired session") };
      case (?userId) {
        if (getUserRole(userId) != #admin) { return #err("Unauthorized: Admin access required") };
        if (periodIndex >= displayPeriods.size()) { return #err("Invalid period index") };
        hourlyLimits.add(periodIndex, limit);
        #ok(());
      };
    };
  };

  // ── History ───────────────────────────────────────────────────────────────
  public query func getHistory(sessionToken : Text, startDate : ?Text, endDate : ?Text) : async [(Text, DailyRecord)] {
    let _ = requireUser(sessionToken);
    newHistoryStore.entries().filter(func((date, _) : (Text, DailyRecord)) : Bool {
      let afterStart = switch (startDate) { case (null) { true }; case (?start) { compareDateStrings(date, start) != #less } };
      let beforeEnd = switch (endDate) { case (null) { true }; case (?end) { compareDateStrings(date, end) != #greater } };
      afterStart and beforeEnd;
    }).toArray();
  };

  public query func getSummary(sessionToken : Text) : async [DaySummary] {
    let _ = requireUser(sessionToken);
    let summaries = List.empty<DaySummary>();
    for ((date, record) in newHistoryStore.entries()) {
      summaries.add({ date; cap = record.cap; countApproved = record.approvals.size(); icNames = record.approvals.map(func(e : ApprovalEntry) : Text { e.icName }) });
    };
    let today = nanosecondsToDateString(Time.now());
    let todayApprovals = newDailyApprovals.toArray().filter(func(e : ApprovalEntry) : Bool { e.exclusionDate == today });
    summaries.add({ date = today; cap = newDailyCap; countApproved = todayApprovals.size(); icNames = todayApprovals.map(func(e : ApprovalEntry) : Text { e.icName }) });
    summaries.toArray();
  };
};
