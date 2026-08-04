const CLASSES = {
  aiChat: "ai-chat",
  aiDialog: "ai-chat-dialog",
  clearChatButton: "ai-chat-clear-button",
};

const deployment = "demo-mini";
const apiVersion = "2024-02-01";
const endpoint = "https://public-api.devexpress.com/demo-openai";
const apiKey = "DEMO";

const emptyViewMessage = "Hello! I am your Page Assistant.";
const emptyViewPrompt = "I can help you update the employee profile or filter the task list.";

const titles = ["Mr.", "Mrs.", "Ms."];
const colors = { High: "#F1BBBC", Normal: "#F9E2AE", Low: "#9FD89F" };
const states = ["California", "New York", "Texas"];
const positions = [
  "CEO",
  "Sales Assistant",
  "CMO",
  "HR Manager",
  "Designer",
  "Developer",
];

const employee = {
  ID: 1,
  Prefix: "Mr.",
  FirstName: "John",
  LastName: "Heart",
  Position: "CEO",
  State: "California",
  BirthDate: "1964/03/16",
};

const tasks = [
  {
    ID: 5,
    Subject: "Choose between PPO and HMO Health Plan",
    StartDate: "2023/02/15",
    DueDate: "2023/04/15",
    Status: "In Progress",
    Priority: "Low",
    Completion: 75,
    EmployeeID: 1,
  },
  {
    ID: 6,
    Subject: "Google AdWords Strategy",
    StartDate: "2023/02/16",
    DueDate: "2023/02/28",
    Status: "Completed",
    Priority: "High",
    Completion: 100,
    EmployeeID: 1,
  },
  {
    ID: 7,
    Subject: "New Brochures",
    StartDate: "2023/02/17",
    DueDate: "2023/02/24",
    Status: "Completed",
    Priority: "Normal",
    Completion: 100,
    EmployeeID: 1,
  },
  {
    ID: 22,
    Subject: "Update NDA Agreement",
    StartDate: "2023/03/14",
    DueDate: "2023/03/16",
    Status: "Completed",
    Priority: "High",
    Completion: 100,
    EmployeeID: 1,
  },
  {
    ID: 52,
    Subject: "Review Product Recall Report by Engineering Team",
    StartDate: "2023/05/17",
    DueDate: "2023/05/20",
    Status: "Completed",
    Priority: "High",
    Completion: 100,
    EmployeeID: 1,
  },
];

const formFields = [
  {
    name: "Prefix",
    description: `Title. Must be one of: ${titles.join(", ")}.`,
    values: titles,
  },
  { name: "FirstName", description: "First name. Free text value." },
  { name: "LastName", description: "Last name. Free text value." },
  {
    name: "Position",
    description: `Job position. Must be one of: ${positions.join(", ")}.`,
    values: positions,
  },
  {
    name: "State",
    description: `US state. Must be one of: ${states.join(", ")}.`,
    values: states,
  },
  { name: "BirthDate", description: "Birth date." },
];
