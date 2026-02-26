import Map "mo:core/Map";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Int "mo:core/Int";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
import List "mo:core/List";
import Principal "mo:core/Principal";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  let nanosecondToSeconds = 1_000_000_000;
  let weekdayOffset = 1;
  let defaultDailyCap = 50;

  let validHours = [
    "7 AM",
    "8 AM",
    "9 AM",
    "10 AM",
    "11 AM",
    "12 PM",
    "1 PM",
    "2 PM",
    "3 PM",
    "4 PM",
    "5 PM",
    "6 PM",
    "7 PM",
  ];

  let displayPeriods = [
    "7 AM - 8 AM",
    "8 AM - 9 AM",
    "9 AM - 10 AM",
    "10 AM - 11 AM",
    "11 AM - 12 PM",
    "12 PM - 1 PM",
    "1 PM - 2 PM",
    "2 PM - 3 PM",
    "3 PM - 4 PM",
    "4 PM - 5 PM",
    "5 PM - 6 PM",
    "6 PM - 7 PM",
  ];

  type ApprovalEntry = {
    entryId : Nat;
    icName : Text;
    managerName : Text;
    timestampNs : Int; // Nanoseconds since epoch
    startHour : Text;
    endHour : Text;
  };

  type DailyRecord = {
    cap : Nat;
    approvals : [ApprovalEntry];
  };

  type DaySummary = {
    date : Text;
    cap : Nat;
    countApproved : Nat;
    icNames : [Text];
  };

  type SlotUsage = {
    timeSlot : Text;
    count : Nat;
  };

  public type SlotUsageWithLimit = {
    timeSlot : Text;
    count : Nat;
    limit : Nat;
  };

  public type HourlyLimit = {
    periodIndex : Nat;
    limit : Nat;
  };

  public type UserProfile = {
    name : Text;
  };

  public type UserInfo = {
    principal : Principal;
    name : Text;
    role : AccessControl.UserRole;
  };

  type State = {
    var lastUpdateNs : Int;
    var dailyCap : Nat;
    var dailyApprovals : List.List<ApprovalEntry>;
    var lastAssignedId : Nat;
  };

  let historyStore = Map.empty<Text, DailyRecord>();
  var state : State = {
    var lastUpdateNs = Time.now();
    var dailyCap = defaultDailyCap;
    var dailyApprovals = List.empty<ApprovalEntry>();
    var lastAssignedId = 0;
  };

  // Access control and profile management
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  let userProfiles = Map.empty<Principal, UserProfile>();
  let hourlyLimits = Map.empty<Nat, Nat>();

  // Helper function: Converts nanoseconds to YYYY-MM-DD Text
  func nanosecondsToDateString(nanoseconds : Int) : Text {
    let seconds = nanoseconds / nanosecondToSeconds;
    let time = seconds.toText();
    time;
  };

  /// Compares two YYYY-MM-DD date strings.
  func compareDateStrings(date1 : Text, date2 : Text) : Order.Order {
    Text.compare(date1, date2);
  };

  // Finds the index of a valid hour in the validHours array.
  func findHourIndex(hour : Text) : ?Nat {
    validHours.indexOf(hour);
  };

  // Checks and resets daily record if new day has started.
  func checkAndResetDay() {
    let today = nanosecondsToDateString(Time.now());
    let lastRecordedDay = nanosecondsToDateString(state.lastUpdateNs);

    if (today != lastRecordedDay) {
      // Archive previous day's record
      let archivedDay = {
        cap = state.dailyCap;
        approvals = state.dailyApprovals.toArray();
      };

      historyStore.add(lastRecordedDay, archivedDay);

      // Clear current day records
      state.lastUpdateNs := Time.now();
      state.dailyApprovals.clear();
    };
  };

  // PUBLIC QUERIES

  public query ({ caller }) func getDailyCap() : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view the daily cap");
    };
    state.dailyCap;
  };

  public query ({ caller }) func getDailyApprovals() : async [ApprovalEntry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view daily approvals");
    };
    state.dailyApprovals.toArray();
  };

  public query ({ caller }) func getRemainingSlots() : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view remaining slots");
    };
    let numApprovals = state.dailyApprovals.size();
    if (numApprovals >= state.dailyCap) { return 0 };
    state.dailyCap - numApprovals;
  };

  public query ({ caller }) func getHistory(startDate : ?Text, endDate : ?Text) : async [(Text, DailyRecord)] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view history");
    };
    let filteredIter = historyStore.entries().filter(
      func((date, _)) {
        let afterStart = switch (startDate) {
          case (null) { true };
          case (?start) { compareDateStrings(date, start) != #less };
        };
        let beforeEnd = switch (endDate) {
          case (null) { true };
          case (?end) { compareDateStrings(date, end) != #greater };
        };
        afterStart and beforeEnd;
      }
    );
    filteredIter.toArray();
  };

  public query ({ caller }) func getSummary() : async [DaySummary] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view summary");
    };
    let summaries = List.empty<DaySummary>();

    for ((date, record) in historyStore.entries()) {
      let icNames = record.approvals.map(func(entry) { entry.icName });
      summaries.add({
        date;
        cap = record.cap;
        countApproved = record.approvals.size();
        icNames;
      });
    };

    // Include today's summary (convert approvals from List to Array).
    let todayApprovals = state.dailyApprovals.toArray();
    let todaySummary = {
      date = nanosecondsToDateString(Time.now());
      cap = state.dailyCap;
      countApproved = todayApprovals.size();
      icNames = todayApprovals.map(func(entry) { entry.icName });
    };
    summaries.add(todaySummary);

    summaries.toArray();
  };

  public query ({ caller }) func getSlotUsage() : async [SlotUsage] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view slot usage");
    };
    getSlotUsageInternal();
  };

  // Helper function for slot usage
  func getSlotUsageInternal() : [SlotUsage] {
    let approvalsArray = state.dailyApprovals.toArray();
    let latestIndex = displayPeriods.size() - 1 : Nat;

    let results = List.empty<SlotUsage>();

    var i = 0 : Nat;
    for (period in displayPeriods.values()) {
      let count = approvalsArray.filter(func(entry) {
        let start = findHourIndex(entry.startHour);
        let end = findHourIndex(entry.endHour);
        switch (start, end) {
          case (?s, ?e) { s <= i and e > i and i <= latestIndex };
          case (_) { false };
        };
      }).size();

      results.add({
        timeSlot = period;
        count;
      });

      i += 1;
    };

    results.toArray();
  };

  public query ({ caller }) func getHourlyLimits() : async [HourlyLimit] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users or admins can view hourly limits");
    };

    let limits = List.empty<HourlyLimit>();

    for ((periodIndex, limit) in hourlyLimits.entries()) {
      limits.add({ periodIndex; limit });
    };

    limits.toArray();
  };

  public query ({ caller }) func getSlotUsageWithLimits() : async [SlotUsageWithLimit] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users or admins can view slot usage with limits");
    };

    let slotUsages = getSlotUsageInternal();
    let results = List.empty<SlotUsageWithLimit>();

    for (slot in slotUsages.values()) {
      let periodIndex = switch (displayPeriods.indexOf(slot.timeSlot)) {
        case (?idx) { idx };
        case (null) { 0 : Nat };
      };
      let limit = switch (hourlyLimits.get(periodIndex)) {
        case (?l) { l };
        case (null) { 10 };
      };
      results.add({
        slot with
        limit;
      });
    };

    results.toArray();
  };

  // PUBLIC UPDATES

  public shared ({ caller }) func setDailyCap(cap : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can set the daily cap");
    };
    checkAndResetDay();
    state.dailyCap := cap;
  };

  public shared ({ caller }) func setHourlyLimit(periodIndex : Nat, limit : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can set hourly limits");
    };

    if (periodIndex >= displayPeriods.size()) {
      Runtime.trap("Invalid period index");
    };

    hourlyLimits.add(periodIndex, limit);
  };

  public shared ({ caller }) func addApproval(
    icName : Text,
    managerName : Text,
    startHour : Text,
    endHour : Text,
  ) : async ApprovalEntry {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add approvals");
    };
    checkAndResetDay();

    let approvalsArray = state.dailyApprovals.toArray();

    if (approvalsArray.size() >= state.dailyCap) {
      Runtime.trap("Cannot add approval: Daily cap reached");
    };

    let startIndex = switch (findHourIndex(startHour)) {
      case (?idx) { idx };
      case (null) { Runtime.trap("Invalid start hour: " # startHour) };
    };
    let endIndex = switch (findHourIndex(endHour)) {
      case (?idx) { idx };
      case (null) { Runtime.trap("Invalid end hour: " # endHour) };
    };

    if (endIndex <= startIndex) {
      Runtime.trap("End hour must be later than start hour");
    };

    // New period max (variable approvals per slot)
    for (periodIndex in Nat.range(startIndex, endIndex)) {
      let periodCount = approvalsArray.filter(
        func(entry) {
          let entryStart = findHourIndex(entry.startHour);
          let entryEnd = findHourIndex(entry.endHour);
          switch (entryStart, entryEnd) {
            case (?es, ?ee) { es <= periodIndex and ee > periodIndex };
            case (_) { false };
          };
        }
      ).size();

      let periodLimit = switch (hourlyLimits.get(periodIndex)) {
        case (?limit) { limit };
        case (null) { 10 };
      };

      if (periodCount >= periodLimit) {
        Runtime.trap("Cannot add approval: Period " # periodIndex.toText() # " is full");
      };
    };

    let newEntry : ApprovalEntry = {
      entryId = state.lastAssignedId;
      icName;
      managerName;
      timestampNs = Time.now();
      startHour;
      endHour;
    };

    state.dailyApprovals.add(newEntry);
    state.lastAssignedId += 1;
    newEntry;
  };

  public shared ({ caller }) func removeApproval(entryId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can remove approvals");
    };
    checkAndResetDay();

    let approvalsList = state.dailyApprovals.toArray();
    let filteredApprovals = approvalsList.filter(func(entry) { entry.entryId != entryId });

    if (approvalsList.size() == filteredApprovals.size()) {
      Runtime.trap("No entry found with id " # entryId.toText());
    };

    state.dailyApprovals.clear();
    for (entry in filteredApprovals.values()) {
      state.dailyApprovals.add(entry);
    };
  };

  // New Admin Functions

  public query ({ caller }) func listAllUsers() : async [UserInfo] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can list users");
    };

    let result = List.empty<UserInfo>();

    for ((principal, profile) in userProfiles.entries()) {
      let role = AccessControl.getUserRole(accessControlState, principal);
      result.add({
        principal;
        name = profile.name;
        role;
      });
    };

    result.toArray();
  };

  public shared ({ caller }) func setUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can set user roles");
    };

    AccessControl.assignRole(accessControlState, caller, user, role);
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (caller.isAnonymous()) Runtime.trap("Anonymous not allowed");
    
    switch (accessControlState.userRoles.get(caller)) {
      case (null) {
        // New user - assign role
        if (not accessControlState.adminAssigned) {
          accessControlState.userRoles.add(caller, #admin);
          accessControlState.adminAssigned := true;
        } else {
          accessControlState.userRoles.add(caller, #guest);
        };
      };
      case (?_) { /* already has role */ };
    };
    
    userProfiles.add(caller, profile);
  };
};
