window.VMSRewards = {
  levelReward(level, score) {
    return Math.max(20, Math.floor(20 + level * 5 + score / 10));
  }
};
