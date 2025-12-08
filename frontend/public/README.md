# Mock Chat History

## Overview

This directory contains sample conversation data for testing and development.

## File: mock_chat_history.jsonl

**Format**: AutoGen JSONL (JSON Lines)
**Messages**: 34 messages
**Agents**: 9 agents (ProductManager, TechLead, BackendDev, FrontendDev, DatabaseAdmin, Designer, QAEngineer, SecurityEngineer, DevOps)
**Scenario**: Software development team implementing a real-time notification system
**Duration**: ~3 hours (09:00 - 11:50)

### Conversation Flow

The mock data demonstrates a realistic multi-agent collaboration:

1. **Requirements Phase** (Messages 1-4)
   - ProductManager initiates feature request
   - TechLead scopes and delegates tasks

2. **Implementation Phase** (Messages 5-11)
   - BackendDev builds WebSocket server and Redis queue
   - FrontendDev creates React notification components
   - DatabaseAdmin sets up infrastructure

3. **Design Integration** (Messages 12-14)
   - Designer provides UI specifications
   - FrontendDev implements design

4. **Testing & Iteration** (Messages 15-22)
   - QAEngineer discovers bug
   - Team fixes reconnection logic
   - Tests pass

5. **Security Review** (Messages 23-29)
   - SecurityEngineer audits implementation
   - BackendDev adds JWT authentication
   - Security approval granted

6. **Deployment** (Messages 30-34)
   - DevOps deploys to staging
   - ProductManager approves for production

### Message Types Demonstrated

- **Delegation**: Task assignments between agents
- **Thought**: Analytical messages ("Analyzing...", "Thinking...")
- **Action**: Execution messages ("Executing...", "Running...")
- **Response**: Status updates and completions
- **System**: Infrastructure and configuration

### Graph Characteristics

The conversation creates an interesting graph with:
- **9 nodes** (unique agents)
- **Multiple edge patterns**:
  - Manager-to-team (hub pattern)
  - Developer-to-developer (peer collaboration)
  - Specialist consultations (expert nodes)
- **Temporal evolution**: Graph grows as new agents join conversation
- **Loop detection**: QA feedback loop (QA → Dev → QA)

### Usage in Application

This file is automatically loaded when users click **"Load Sample Data"** in the PreFlight upload modal, making it easy to test the dashboard without manual file uploads.

### Customization

To create your own mock data:
1. Follow the AutoGen JSONL format
2. Each line must be valid JSON with fields: `sender`, `recipient`, `message`, `role`, `timestamp`
3. Use ISO 8601 timestamps
4. Place in `frontend/public/` directory
5. Reference in PreFlightModal component
