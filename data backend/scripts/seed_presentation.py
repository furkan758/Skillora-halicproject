"""Add fictional presentation records without resetting or replacing existing data.

Run explicitly: python -m scripts.seed_presentation
Safe to repeat: existing names and tagged scenarios are left unchanged.
"""
import json
from app.config import get_settings
from app.database import Database
from app.repositories.skillora import SkilloraRepository
from app.schemas import CandidateInput, EmployeeInput, FolderInput, ScenarioInput, SkillInput

EXTRA_SKILLS = {
    "Frontend": ["Vue.js", "Sass", "Web Performance", "Web Components", "Responsive Design", "Storybook", "HTML Semantics", "Browser APIs", "State Management"],
    "Backend": ["Next.js", "REST API Design", "API Documentation", "Background Jobs", "Authentication Design", "Python Testing"],
    "Design": ["Prototyping", "User Research", "Design Systems", "Interaction Design"],
    "Management": ["Scrum", "Risk Management", "Stakeholder Communication"],
    "DevOps": ["Git", "Kubernetes", "Release Management"],
    "Mobile": ["Kotlin", "Swift", "Mobile Testing"],
    "Data & Analytics": ["Data Visualization", "Data Modeling", "ETL"],
    "AI & Machine Learning": ["Model Evaluation", "Natural Language Processing"],
    "Cloud": ["Azure Functions", "Cloud Architecture"],
    "Quality Assurance": ["Playwright", "API Testing", "Regression Testing"],
    "Security": ["Application Security", "Security Review"],
    "Databases": ["T-SQL", "Database Design", "Query Optimization", "SQL Server Indexing"],
    "Business Analysis": ["Business Process Mapping", "Acceptance Criteria"],
    "Digital Marketing": ["Campaign Analytics", "Email Marketing"],
    "Customer Success": ["Customer Training", "Support Operations"],
    "Architecture": ["System Design", "Integration Architecture"],
    "Documentation": ["Technical Writing", "Knowledge Management"],
    "Product": ["Product Discovery", "Roadmap Planning"],
    "Finance": ["Budget Planning", "Cost Estimation"],
}
PROFILES = [
    ("Engineering", "Frontend Developer", ["React", "JavaScript", "TypeScript", "CSS", "Sass", "Accessibility", "Responsive Design"], 9),
    ("Engineering", "Backend Developer", ["Python", "FastAPI", "Microsoft SQL Server", "REST API Design", "T-SQL", "API Documentation"], 9),
    ("Design", "Product Designer", ["Figma", "UX Design", "Prototyping", "User Research", "Design Systems"], 6),
    ("Data & AI", "Data Analyst", ["Data Analysis", "Power BI", "Python", "Data Visualization", "Data Modeling"], 6),
    ("Operations", "DevOps Engineer", ["Docker", "CI/CD", "Microsoft Azure", "Git", "Kubernetes"], 6),
    ("Quality Assurance", "QA Engineer", ["Manual Testing", "Test Automation", "Playwright", "API Testing", "Regression Testing"], 6),
]
PEOPLE = [
    ("Alex", "Morgan"), ("Emma", "Carter"), ("Liam", "Brooks"), ("Olivia", "Reed"),
    ("Noah", "Bennett"), ("Ava", "Hayes"), ("Ethan", "Parker"), ("Mia", "Collins"), ("Sam", "Rivera"),
    ("Lucas", "Walker"), ("Sophia", "Mitchell"), ("Mason", "Turner"), ("Isabella", "Scott"),
    ("James", "Cooper"), ("Amelia", "Bailey"), ("Benjamin", "Foster"), ("Harper", "Price"), ("Taylor", "Quinn"),
    ("Henry", "Sanders"), ("Evelyn", "Ross"), ("Daniel", "Powell"), ("Abigail", "Hughes"), ("Jack", "Griffin"), ("Ella", "Ward"),
    ("Oliver", "Russell"), ("Scarlett", "Bell"), ("William", "Diaz"), ("Grace", "Cole"), ("Leo", "Stone"), ("Chloe", "Wood"),
    ("David", "West"), ("Lily", "Green"), ("Gabriel", "Morris"), ("Zoe", "Hart"), ("Aria", "Lane"), ("Robin", "Fox"),
    ("Nathan", "King"), ("Nora", "Adams"), ("Isaac", "Hill"), ("Layla", "Shaw"), ("Owen", "Wells"), ("Jamie", "Blair"),
]
SCENARIOS = [
    ("Corporate website", ["React", "Python", "Figma"]),
    ("Corporate website", ["React", "Python", "Figma"]),
    ("Customer portal", ["React", "FastAPI"]),
    ("Analytics dashboard", ["Power BI", "Data Analysis"]),
    ("Design refresh", ["Figma", "Prototyping"]),
    ("Cloud deployment", ["Docker", "Microsoft Azure"]),
    ("Quality review", ["Test Automation", "API Testing"]),
    ("Employee workspace", ["React", "Microsoft SQL Server"]),
    ("Customer insights", ["Data Analysis", "Python"]),
    ("Component library", ["React", "Design Systems"]),
    ("API integration", ["Python", "REST API Design"]),
    ("Mobile-ready website", ["React", "Responsive Design"]),
    ("Research sprint", ["User Research", "Figma"]),
    ("Reporting platform", ["Power BI", "T-SQL"]),
    ("Release automation", ["CI/CD", "Docker"]),
    ("Regression suite", ["Playwright", "Regression Testing"]),
]

def seed_presentation(repo: SkilloraRepository):
    repo.ready()
    catalog = repo.catalog()
    folders = {f["name"]: f for f in catalog["folders"]}
    all_skill_names = {r["SkillName"].casefold() for r in repo.db.query("SELECT SkillName FROM dbo.SKILLS")}
    for folder_name, skill_names in EXTRA_SKILLS.items():
        if folder_name not in folders:
            folders[folder_name] = repo.save_folder(FolderInput(name=folder_name, description="Presentation skill category."))
        for name in skill_names:
            if name.casefold() not in all_skill_names:
                repo.save_skill(SkillInput(name=name, folderId=folders[folder_name]["id"]))
                all_skill_names.add(name.casefold())
    skills = {s["name"]: s for s in repo.catalog()["skills"]}
    departments = {d["name"]: d["id"] for d in repo.departments()}
    existing = {(r["FirstName"].casefold(), r["LastName"].casefold()) for r in repo.db.query("SELECT FirstName,LastName FROM dbo.EMPLOYEES")}
    offset = 0
    for department, job, names, count in PROFILES:
        for i in range(count):
            first, last = PEOPLE[offset]
            key = (first.casefold(), last.casefold())
            if key not in existing:
                gender = ["Male", "Female", "Not specified"][offset % 3]
                repo.save_employee(EmployeeInput(
                    firstName=first, lastName=last, gender=gender, jobTitle=job,
                    departmentId=departments[department], isAvailable=i % 5 != 4,
                    skills=[{"skillId": skills[name]["id"], "proficiencyLevel": 3 + ((i + n) % 3),
                             "experienceYears": round(1.5 + (i % 6) * 0.7 + n * 0.2, 1)}
                            for n, name in enumerate(names) if name in skills],
                ))
                existing.add(key)
            offset += 1
    for index, (title, names) in enumerate(SCENARIOS, 1):
        brief = f"Presentation sample {index:02d}. Fictional project for the local classroom demonstration."
        if repo.db.query("SELECT ScenarioID FROM dbo.SCENARIOS WHERE ProjectBrief=?", (brief,)):
            continue
        requirements, assignments, excluded = [], [], []
        for name in names:
            if name not in skills:
                raise RuntimeError(f"The presentation requires an active skill: {name}")
            skill_id = skills[name]["id"]
            quota = 2 if index <= 2 and name == "React" else 1
            candidates = repo.candidates(CandidateInput(
                skillId=skill_id, onlyAvailable=True, excludedEmployeeIds=excluded, page=1))["items"]
            if len(candidates) < quota:
                raise RuntimeError(f"Not enough eligible employees for presentation skill {name}. Existing records were not replaced.")
            requirements.append({"skillId": skill_id, "count": quota})
            for c in candidates[:quota]:
                employee_id = c["employee"]["id"]
                assignments.append({"employeeId": employee_id, "skillId": skill_id})
                excluded.append(employee_id)
        repo.save_scenario(ScenarioInput(
            clientName=["Aster Studio (Demo)", "Northwind Labs (Demo)", "Cedar Works (Demo)", "Harbor Group (Demo)"][(index - 1) % 4],
            projectTitle=title, projectBrief=brief, requiredPeople=len(assignments), onlyAvailable=True,
            requirements=requirements, assignments=assignments,
        ))
    return {"overview": repo.overview(), "folders": len(repo.catalog()["folders"]),
            "scenarios": repo.list_scenarios(1, "", None)["total"]}

def main():
    print(json.dumps(seed_presentation(SkilloraRepository(Database(get_settings()))), indent=2))

if __name__ == "__main__":
    main()
