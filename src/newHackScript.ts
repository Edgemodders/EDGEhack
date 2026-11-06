// The small script a new quickhack needs (docs/design.md, "H3: plan"; proved by the H3.1 spike). The game
// shows a hack of V's on an enemy only if the enemy's own list has a hack of that name, and 5,796
// character records carry a list, so this adds V's EDGEhack hacks when the game asks for an enemy's actions.

/** Where it goes under the project's resources: one path for every EDGEhack mod, so only one copy loads. */
export const NEW_HACK_SCRIPT_PATH = ["r6", "scripts", "EDGEhack", "NewQuickhacks.reds"];

export const NEW_HACK_SCRIPT = `// Made by EDGEhack, for new quickhacks. Every mod made with EDGEhack ships this same file at this path.
// It touches only hacks in V's cyberdeck whose action name starts with "EDGEhack".

@wrapMethod(ScriptedPuppetPS)
public const final func GetAllChoices(const actions: script_ref<array<wref<ObjectAction_Record>>>, const context: script_ref<GetActionsContext>, puppetActions: script_ref<array<ref<PuppetAction>>>) -> Void {
  let all: array<wref<ObjectAction_Record>> = Deref(actions);
  let player = GetPlayer(this.GetGameInstance());
  if IsDefined(player) {
    let hacks = RPGManager.GetPlayerQuickHackListWithQuality(player);
    let i = 0;
    while i < ArraySize(hacks) {
      let record = hacks[i].actionRecord;
      if IsDefined(record)
        && Equals(record.ObjectActionType().Type(), gamedataObjectActionType.PuppetQuickHack)
        && StrBeginsWith(NameToString(record.ActionName()), "EDGEhack")
        && !ArrayContains(all, record) {
        ArrayPush(all, record);
      }
      i += 1;
    }
  }
  wrappedMethod(all, context, puppetActions);
}
`;
