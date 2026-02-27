CSV Analytics & Data Processing Platform

A full-stack CSV data processing system built with Node.js (Express) and vanilla JavaScript.
The application allows users to upload messy real-world CSV files, performs server-side validation and cleaning, computes structured analytics, and renders interactive visualizations in the browser.
Designed to simulate real business data workflows where datasets are inconsistent, incomplete, and poorly formatted.

-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Features
1. File Upload Handling
   - CSV upload via frontend form
   - Multer middleware for secure server-side file handling
   - File size limits and type validation

2. Schema Validation
   - Required column enforcement
   - Unexpected column detection
   - Structured error reporting

3. Data Cleaning Pipeline
   Handles messy, real-world data such as:
   - Currency symbols (£, $, €)
   - Commas in numeric values
   - Inconsistent booleans (Yes, TRUE, 1, In Stock, etc.)
   - Invalid ratings
   - Mixed date formats
   - Missing values
   - Whitespace inconsistencies

5. Analytics Engine
   Server-side aggregation including:
   - Row counts
   - Missing value statistics
   - Min / Max / Mean calculations
   - Product frequency analysis
   - In-stock vs out-of-stock counts
   - Monthly time-series grouping

6. Data Visualization
   - Interactive charts using Chart.js
   - Bar charts
   - Horizontal ranking charts
   - Multi-axis line charts
   - Cleaned data preview table

-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Tech Stack
1. Backend
   - Node.js
   - Express
   - Multer (file handling)
   - csv-parse (CSV parsing)

3. Frontend
   - Vanilla JavaScript
   - Chart.js
   - HTML5
   - CSS3

5. Data Format
   - JSON API responses

-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Architecture Overview
1. User uploads CSV via frontend
2. Server receives file (Multer)
3. CSV parsed into structured objects
4. Column validation executed
5. Data cleaning & normalization pipeline runs
6. Aggregation logic computes analytics
7. JSON response returned to frontend
8. Charts render dynamically
   
This mirrors a simplified real-world ETL (Extract → Transform → Load) workflow.

-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Installation
1. Clone the repository


3. Install dependencies

   npm install


4. Start the server

   npm start

5. Open in browser

-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Example CSV Format

Required columns:
   product, price, rating, instock, launch_date

The system is intentionally built to handle inconsistent formatting.

-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Author

Built as a demonstration of full-stack data processing and visualization capabilities.
