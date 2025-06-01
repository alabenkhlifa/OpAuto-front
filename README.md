# OpAuto

OpAuto (Operations Auto) is a web-based application designed to streamline operations for automotive repair shops. It offers an intuitive interface for managing appointments, tracking maintenance logs, handling payments, and more — all tailored to the needs of garage owners and technicians.

---

## 🚀 Features

### 1. **Authentication & Authorization**
- **Admin-Only Access:** Secure login system using JWT-based authentication.
- **Role-Based Access:** Ensure that only authorized users can access specific features.

### 2. **Car Management**
- **Add New Cars:** Register new vehicles with essential details.
- **Update Car Information:** Modify existing car records as needed.
- **View Car List:** Access a comprehensive list of all registered vehicles.

### 3. **Maintenance Logs**
- **Record Maintenance Activities:** Log details of maintenance performed on each vehicle.
- **View Maintenance History:** Access a chronological history of all maintenance activities for each car.

### 4. **Appointment Scheduling**
- **Create Appointments:** Schedule maintenance appointments for vehicles.
- **Update Appointments:** Modify existing appointments as required.
- **View Appointment Calendar:** Access a calendar view of all upcoming appointments.

### 5. **Notifications**
- **Appointment Reminders:** Receive notifications for upcoming appointments.
- **Configurable Preferences:** Set and adjust notification preferences.

### 6. **Garage Information & Settings**
- **Manage Garage Details:** Update information about the garage, such as name, location, and contact details.
- **Set Operational Hours:** Define working hours and break times.
- **View Garage Capacity:** Monitor available slots and resources.

### 7. **Payments & Approvals**
- **Log Payments:** Record cash payments received for services rendered.
- **Purchase Approval Workflow:** Submit and approve requests for parts and materials.

### 8. **Search & Reporting**
- **Filter Records:** Search and filter cars, appointments, and maintenance logs.
- **Export Reports:** Generate and export reports for analysis and record-keeping.

---

## 🛠️ Tech Stack

- **Backend:** Spring Boot (Kotlin / JDK 21 LTS)
- **Frontend:** Angular
- **Database:** PostgreSQL
- **Authentication:** JWT (JSON Web Tokens)
- **Containerization:** Docker & Docker Compose
- **Database Migrations:** Flyway

---

## 🧪 Development Setup

### Prerequisites

Ensure you have the following installed:

- **Java 21 LTS**: [Download JDK 21](https://www.oracle.com/java/technologies/downloads/)
- **Node.js**: [Download Node.js](https://nodejs.org/)
- **Docker & Docker Compose**: [Install Docker](https://www.docker.com/products/docker-desktop)

### Backend Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/alabenkhlifa/opauto.git
   cd opauto
