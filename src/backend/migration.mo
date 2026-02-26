module {
  type OldActor = {};
  type NewActor = { adminAssigned : Bool };

  public func run(old : OldActor) : NewActor {
    { old with adminAssigned = false };
  };
};
