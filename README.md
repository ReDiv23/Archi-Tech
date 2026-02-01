# 🏗️ ArchiTech – Interactive Floor Planner

ArchiTech is a web-based 2D floor planning application built using React and React Konva.  
It allows users to design architectural floor plans by drawing walls, placing furniture and symbols, adding shapes, annotating text, and managing projects with autosave, undo/redo, and import/export support.

This project was built during a hackathon with a focus on usability, precision, and real-world architectural workflows.

---

## ✨ Features

### 🧱 Wall Drawing
•⁠  ⁠Click-and-drag wall creation
•⁠  ⁠Fixed real-world wall thickness
•⁠  ⁠Live wall length preview
•⁠  ⁠Wall measurements displayed in feet and inches
•⁠  ⁠Editable wall length and angle
•⁠  ⁠Wall rotation and resizing with thickness lock

### 🔷 Shapes
•⁠  ⁠Draw rectangles, circles, triangles, and arrows
•⁠  ⁠Live preview while drawing
•⁠  ⁠Drag, resize, and rotate shapes

### 🪑 Icons & Furniture
•⁠  ⁠Architectural symbols including:
  - Doors (single, double, sliding)
  - Windows
  - Beds, sofas, dining tables
  - Kitchen and bathroom fixtures
  - TV, AC unit, stairs, shaft, compass
•⁠  ⁠Drag, resize, and rotate icons
•⁠  ⁠Flip icons horizontally and vertically

### ✏️ Text Annotations
•⁠  ⁠Add text boxes anywhere on the canvas
•⁠  ⁠Double-click to edit text
•⁠  ⁠Resize, move, and rotate text
•⁠  ⁠Inline text editing using HTML overlay

### ↩️ Undo / Redo
•⁠  ⁠Multi-step undo and redo (up to 50 actions)
•⁠  ⁠Keyboard shortcuts:
  - Ctrl + Z → Undo
  - Ctrl + Y / Ctrl + Shift + Z → Redo

### 📋 Copy / Paste
•⁠  ⁠Copy and paste walls, shapes, and icons
•⁠  ⁠Keyboard shortcuts:
  - Ctrl + C
  - Ctrl + V

### 💾 Autosave
•⁠  ⁠Automatic saving of projects
•⁠  ⁠Debounced updates for performance
•⁠  ⁠Supports authenticated and shared projects

### 📤 Import / Export
•⁠  ⁠Export floor plans as ⁠ .ArchiTech ⁠ (JSON-based) files
•⁠  ⁠Import previously saved projects

### 👀 View-Only Mode
•⁠  ⁠Read-only project sharing
•⁠  ⁠Prevents editing for safe viewing and presentations

### 🧹 Canvas Controls
•⁠  ⁠Clear entire canvas with confirmation
•⁠  ⁠Collapsible sidebar
•⁠  ⁠Mode-based cursor changes
•⁠  ⁠Responsive toolbar UI

---

## 📐 Measurement System

•⁠  ⁠Scale: 14 pixels = 1 foot
•⁠  ⁠Automatic conversion to feet and inches
•⁠  ⁠Dynamic measurement labels rendered on canvas

---

## 🛠 Tech Stack

•⁠  ⁠React
•⁠  ⁠React Konva
•⁠  ⁠react-konva-utils
•⁠  ⁠use-image
•⁠  ⁠React Router
•⁠  ⁠Custom project services for persistence

---

## ⌨️ Keyboard Shortcuts

| Action | Shortcut |
|------|--------|
| Undo | Ctrl + Z |
| Redo | Ctrl + Y / Ctrl + Shift + Z |
| Delete | Delete / Backspace |
| Copy | Ctrl + C |
| Paste | Ctrl + V |

---

## 📂 Project Structure
