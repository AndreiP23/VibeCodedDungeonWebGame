# Project Copilot Instructions

Use the local agent system for feature work:

- Use the orchestrator agent first for routing and task plans.
- Use the core review agent for risk checks and change reviews.
- Use coding agents for implementation and debugging workflows.

When changing backend orchestration logic, inspect files in `src/lib/agents/` and the API route in `src/app/api/agent/route.ts`.
