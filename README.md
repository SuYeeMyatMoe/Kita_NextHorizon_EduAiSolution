# 🚀 NextHorizon: The AI Co-Pilot for Hybrid Education

<div align="center">

![Status](https://img.shields.io/badge/Status-Prototype-blue?style=for-the-badge&logo=appveyor)
![Hackathon](https://img.shields.io/badge/Event-KitaHack_2026-orange?style=for-the-badge&logo=google)
![Tech](https://img.shields.io/badge/Stack-Gemini_2.5_Flash_|_Firebase_|_React-red?style=for-the-badge)

<h3>Reclaiming the art of teaching by automating the science of administration.</h3>
</div>

---

## 📸 Project Screenshots
| **Teacher Dashboard** | **Multimodal Grading Feedback** |
|:---:|:---:|
| ![Dashboard](https://github.com/SuYeeMyatMoe/Kita_NextHorizon_EduAiSolution/blob/1b8f86c01019306d0a794e4d8cf5006c622bd76b/Images/Dashboard.png?raw=true) | ![Grading](https://github.com/SuYeeMyatMoe/Kita_NextHorizon_EduAiSolution/blob/1b8f86c01019306d0a794e4d8cf5006c622bd76b/Images/Feedback.png?raw=true) |
| *Real-time analytics & Quick Actions* | *Evidence-based feedback on PDFs & Videos* |

| **Smart Roll Call** | **Report Card** |
|:---:|:---:|
| ![Roll Call](https://github.com/SuYeeMyatMoe/Kita_NextHorizon_EduAiSolution/blob/429b06365425efaebf39f9d49f28ed6f978f8ddd/Images/SmartRollCall.png) | ![Report Card](https://github.com/SuYeeMyatMoe/Kita_NextHorizon_EduAiSolution/blob/1b8f86c01019306d0a794e4d8cf5006c622bd76b/Images/Reportcard.png?raw=true) |
| *Instant attendance tracking & QR scan* | *Performance summaries report card according to grading* |


---

## 📖 Table of Contents
- [🚩 Problem Statement](#-problem-statement)
- [💡 Solution Overview](#-solution-overview)
- [✨ Key Features](#-key-features)
- [🛠 Tech Stack](#-tech-stack)
- [🤖 Google Technology Implementation](#-google-technology-implementation)
- [🏗 Architecture](#-architecture)
- [💻 Installation & Setup](#-installation--setup)
- [🗺 Future Roadmap](#-future-roadmap)

---

## 🚩 Problem Statement

**The "Post-COVID" Admin Crisis**
While the world has moved to hybrid learning, the administrative workload for teachers has doubled. They are managing physical classrooms while simultaneously juggling digital submissions, online engagement, and fragmented software tools.

* **The Gap:** Students have "super-powered" AI learning aids, while teachers are stuck using fragmented, manual tools (spreadsheets, basic LMS) that don't talk to each other.
* **The Pain:** **60%** of an educator's time is lost to grading, data entry, and formatting resources—leading to severe burnout and less time for mentorship.

---

## 💡 Solution Overview

**NextHorizon** is an all-in-one AI ecosystem designed to bridge the physical and digital classroom. It acts as an active **AI Teaching Assistant** that handles the "invisible labor" of education.

> **Target SDG:** 🌍 **Goal 4: Quality Education** (Target 4.c: Increase supply of qualified teachers).

---

## ✨ Key Features

### 🎓 For Teachers (The Admin Killer)
1.  **Multimodal "Glass Box" Grading**
    * Grades **PDFs, Docs, Images (Handwriting OCR)**, and even **YouTube Video Links**.
    * Provides transparent, evidence-based feedback (e.g., timestamps in videos, highlighted text in docs) so teachers trust the score.
2.  **AI Content Studio**
    * One-click generation of Quizzes, Lesson Plans, and Slide Decks.
    * **Auto-Export:** Downloads directly as `.docx`, `.csv` (Excel ready), and PowerPoint.
    * **Visual Aid Gen:** Uses `gemini-3-pro-image-preview` to generate accurate scientific/educational diagrams.
3.  **Live Hybrid Attendance**
    * Real-time QR code scanning for students.
    * Instant sync to teacher dashboard with manual override for connectivity issues.
4.  **Predictive Risk Dashboard**
    * Analyzes grade trends to flag "At-Risk" students before they drop out.

### 🎒 For Students
* **Study Buddy:** Auto-generate flashcards and summaries from the teacher's uploaded materials.
* **Deadline Manager:** Automated calendar syncing for assignments.

---

## 🛠 Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React + Vite | Fast, responsive dashboard UI written in TypeScript. |
| **Styling** | Tailwind CSS | Modern, utility-first styling for rapid development. |
| **Auth** | Firebase Auth | Secure Google Login & Email authentication. |
| **Database** | Cloud Firestore | Real-time NoSQL database for instant attendance sync. |
| **AI Logic** | **Gemini 2.5 Flash** | Ultra-low latency model for grading & text generation. |
| **AI Creative** | **Gemini 3 Pro** | High-reasoning model for image generation & complex problem solving. |

---

## 🤖 Google Technology Implementation

| Google Tech | Implementation Details | Impact (Cause & Effect) |
| :--- | :--- | :--- |
| **Gemini 2.5 Flash** | Used via Google AI Studio SDK (`@google/genai`) for all text-based grading tasks. | **Effect:** Reduced grading latency by **40%** per student compared to Pro models, enabling "Live Feedback" during class sessions. |
| **Gemini 3 Pro** | Integrated into "Content Studio" for Image Generation. | **Effect:** Allows teachers to create copyright-free, curriculum-accurate diagrams instantly. |
| **Firebase Auth** | Implemented Google Sign-In provider. | **Effect:** Zero-friction onboarding for schools already using Google Workspace for Education. |
| **Firestore** | Real-time listeners (`onSnapshot`) for attendance data. | **Effect:** Enables the "Live QR" feature where a student's phone scan updates the projector screen instantly. |

---

## 🏗 Architecture

graph TD
    %% Styling
    classDef user fill:#e3f2fd,stroke:#1565c0,stroke-width:2px;
    classDef frontend fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;
    classDef firebase fill:#fff3e0,stroke:#ff6f00,stroke-width:2px;
    classDef ai fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;

    %% Users
    Teacher[👩‍🏫 Teacher]:::user
    Student[👨‍🎓 Student]:::user

    %% Frontend App
    subgraph NextHorizon_Client ["💻 NextHorizon Client (React + Vite)"]
        Dashboard[UI / Dashboard]:::frontend
        
        subgraph Features
            Att["📸 Smart Roll Call\n(QR Scanner)"]:::frontend
            Grade["📝 Multimodal Grading\n(PDF/Video Processor)"]:::frontend
            Studio["🎨 Content Studio\n(Generator)"]:::frontend
        end
        
        Export["📄 Export Engine\nDOCX/PPT/CSV"]:::frontend
    end

    %% Backend Services
    subgraph Google_Cloud ["☁️ Google Cloud Platform"]
        Auth[🔥 Firebase Auth]:::firebase
        DB[("🔥 Firestore DB\nReal-time Sync")]:::firebase
    end

    %% AI Logic
    subgraph AI_Engine ["🤖 Google AI Studio"]
        SDK[Google GenAI SDK]:::ai
        
        subgraph Models
            Flash["⚡ Gemini 2.5 Flash\n(High Speed / Large Context)"]:::ai
            Pro["🧠 Gemini 3 Pro\n(Complex Reasoning / Image Gen)"]:::ai
        end
    end

    %% Flows
    Teacher -->|Login| Auth
    Student -->|Scan QR| Att
    
    %% Attendance Flow
    Att -->|Write Presence| DB
    DB -->|OnSnapshot Update| Dashboard

    %% Grading Flow
    Teacher -->|Upload PDF/Video Link| Grade
    Grade -->|Unstructured Data| SDK
    SDK -->|Grading Logic| Flash
    Flash -->|JSON Feedback| Dashboard

    %% Content Creation Flow
    Teacher -->|Request Lesson Plan| Studio
    Studio -->|Prompt| SDK
    SDK -->|Text Generation| Flash
    SDK -->|Image/Diagram Gen| Pro
    Pro -->|Visual Assets| Studio
    
    %% Export
    Studio -->|Raw Content| Export
    Export -->|Download File| Teacher


---
## 💻 Installation & Setup

### 📋 Prerequisites

Make sure you have the following installed and configured:

- **Node.js** (v18 or higher)
- **Google Cloud Project** (for Firebase configuration)
- **Google AI Studio API Key** (for Gemini models)
- **Firebase Project** (Authentication, Firestore, or other services if used)

---

### 🚀 Steps to Run the Project

#### 1️⃣ Clone the Repository

```bash
git clone https://github.com/yourusername/next-horizon.git
cd next-horizon
```
#### 2️⃣ Install Dependencies
```bash
npm install
```

#### 3️⃣ Environment Configuration
Create a .env file in the root directory and add:
```bash
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_GEMINI_API_KEY=your_google_ai_studio_key
```
#### 4️⃣ Run the Development Server
```bash
npm run dev
```
