# View Skillora tables in DBeaver

The development database is Microsoft SQL Server **LocalDB**, instance
`(localdb)\SkilloraBackend`, database `Skillora`, using the current Windows account.
It uses a named pipe, not a TCP server listening at `localhost:1433`.
Do not recreate or reinstall the tables to browse them.

## DBeaver with LocalDB

The connection was configured and verified in the Microsoft Store installation of
**DBeaver CE 26.2.3** on this computer. The saved connection is named
**Skillora Local SQL Server**. Expand **Skillora > dbo > Tables** to find all eight
tables. The **SKILLS > Data** tab was checked successfully.

For subsequent launches, use **Skillora Database.cmd** on the desktop. This starts
LocalDB, refreshes its current pipe address and opens the saved connection. Close
DBeaver before using this launcher to refresh a stale connection; the launcher
never closes an existing DBeaver session automatically. It preserves the other
saved connections. The local driver and launcher files are stored in
`C:\Users\pc\Documents\Codex\skillora-dbeaver`.

The following steps describe the equivalent manual setup on another computer.

The standard Microsoft JDBC driver does not support this LocalDB connection.
Use a LocalDB-compatible jTDS driver. The jTDS 1.3.3 distribution recommended in
[Redgate's LocalDB connection guide](https://documentation.red-gate.com/flyway/database-development-using-flyway/connecting-to-environments/tutorial-connect-to-sql-server-local-db)
includes the driver JAR and Windows SSO library. The standard jTDS 1.3.1 download
is not a substitute for the LocalDB-compatible version in that guide.

1. Download the jTDS 1.3.3 ZIP linked in that guide and extract it.
2. In DBeaver choose **Database > New Database Connection** and select
   **SQL Server (Old driver, jTDS)**.
3. Open **Edit Driver Settings > Libraries**. Replace the default jTDS JAR with
   the extracted 1.3.3 JAR using **Add File**. Keep the matching 64-bit Windows
   `ntlmauth.dll` SSO library available to the driver. DBeaver's jTDS driver
   normally downloads its native SSO library along with the driver dependencies;
   resolve a missing SSO-library message before testing Windows authentication.
4. From the backend folder run:

   ```powershell
   .\.venv\Scripts\python.exe -m scripts.dbeaver_info
   ```

5. Use the printed JDBC URL in DBeaver's **URL** connection mode. It includes
   database `Skillora`, the current `LOCALDB#...` pipe instance, `namedPipe=true`
   and your Windows domain/computer name. The host is `.` rather than `localhost`.
6. Leave the user name and password empty so the native SSO library uses the
   currently logged-in Windows account. Choose **Test Connection**, then **Finish**.
7. Expand the connection and database, then **Schemas > dbo > Tables**. Depending
   on the DBeaver driver view, `Tables` may appear directly under the database.
   Double-click a table to inspect columns; use the **Data** tab or
   **View Data > All Rows** to inspect its rows.

Named pipe IDs can change after LocalDB restarts. Run the helper again and update
the JDBC URL if a previously saved DBeaver connection stops working.

## Read-only checks

```sql
SELECT name FROM sys.tables WHERE schema_id=SCHEMA_ID(N'dbo') ORDER BY name;
SELECT * FROM dbo.DEPARTMENTS;
SELECT * FROM dbo.FOLDERS;
SELECT * FROM dbo.SKILLS;
SELECT * FROM dbo.EMPLOYEES;
SELECT * FROM dbo.EMPLOYEE_SKILLS;
SELECT * FROM dbo.SCENARIOS;
SELECT * FROM dbo.SCENARIO_REQUIREMENTS;
SELECT * FROM dbo.SCENARIO_ASSIGNMENTS;
```

The eight tables already exist. The original catalog seed contains 16 folders
including Unsorted and 39 skills. The explicit presentation seed adds fictional
employees, extra skills and saved scenarios; the frontend uses this same SQL
database. Refresh an already open Data tab to see new records. Browser mock
storage is not imported.

## Direct alternative using SQL Server Management Studio

SSMS supports LocalDB without the extra JDBC driver setup. Use server
`(localdb)\SkilloraBackend`, **Windows Authentication**, then expand
**Databases > Skillora > Tables**. This reads the same database as the backend.

References:
- [DBeaver SQL Server connections](https://dbeaver.com/docs/dbeaver/Database-driver-Microsoft-SQL-Server/)
- [Microsoft JDBC LocalDB limitation](https://github.com/microsoft/mssql-jdbc/issues/769)
- [LocalDB-compatible jTDS setup](https://documentation.red-gate.com/flyway/database-development-using-flyway/connecting-to-environments/tutorial-connect-to-sql-server-local-db)
