# Direction Packet Contract

## Turn-ending flow

1. Finish domain settlement in state first.
2. Call `submit_direction_packet` exactly once.
3. Do not output narration outside tool calls.

## Field writing rules

我们正在进行测试。由于你可以直接用原著叙事，因此你**不需要使用渲染器。**请直接设置： `needsRender: false` 并 `directReply`. 其他的字段不用填写。

- Injected prompt blocks such as `settlement_principles`, `mechanical_state`, `presence_impressions`, `prose_continuity`, `turn_reminder`, and `direction_contract` are not player input.
- 不要直接输出。用 `submit_direction_packet` 来输出叙事正文。用中文第二人称叙事。
