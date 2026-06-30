# Split public and secret game state

We split `GameState` into `PublicGameState` and `SecretGameState`: the GM Brief and player-facing status tools are derived only from the public slice, while hidden truths live in the secret slice and can influence play only through narrow private-resolution or revelation tools. This deliberately avoids the simpler full-state prompt dump because Fate play depends on hidden identities, motives, and Noble Phantasms not leaking into narration before discovery.
