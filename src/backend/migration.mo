import Map "mo:core/Map";
import List "mo:core/List";
import AccessControl "authorization/access-control";

module {
  public type ApprovalEntry = {
    entryId : Nat;
    icName : Text;
    managerName : Text;
    timestampNs : Int;
    startHour : Text;
    endHour : Text;
  };

  public type DailyRecord = {
    cap : Nat;
    approvals : [ApprovalEntry];
  };

  public type HourlyLimit = {
    periodIndex : Nat;
    limit : Nat;
  };

  public type UserProfile = {
    name : Text;
  };

  public type State = {
    var lastUpdateNs : Int;
    var dailyCap : Nat;
    var dailyApprovals : List.List<ApprovalEntry>;
    var lastAssignedId : Nat;
  };

  type OldActor = {
    historyStore : Map.Map<Text, DailyRecord>;
    state : State;
    accessControlState : AccessControl.AccessControlState;
    userProfiles : Map.Map<Principal, UserProfile>;
  };

  type NewActor = {
    historyStore : Map.Map<Text, DailyRecord>;
    state : State;
    accessControlState : AccessControl.AccessControlState;
    userProfiles : Map.Map<Principal, UserProfile>;
    hourlyLimits : Map.Map<Nat, Nat>;
  };

  public func run(old : OldActor) : NewActor {
    // Initialize hourly limits with default values (10 for each of 12 periods)
    let defaultHourlyLimits = Map.empty<Nat, Nat>();
    for (i in Nat.range(0, 12)) {
      defaultHourlyLimits.add(i, 10);
    };

    {
      historyStore = old.historyStore;
      state = old.state;
      accessControlState = old.accessControlState;
      userProfiles = old.userProfiles;
      hourlyLimits = defaultHourlyLimits;
    };
  };
};
