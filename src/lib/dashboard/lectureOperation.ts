
export async function loadClasses() {
    loading = true;
    try {
        const snapshot = await getDocs(collection(db, 'classes'));
        const classesData = snapshot.docs.map((d) => ({
            id: d.id,
            name: d.data()['name'],
            code: d.data()['code'],
            lectures: undefined,
            students: d.data()['enroledStudents'],
        }));
        classes = classesData;
        expanded = new Set(classesData.map((c) => c.id));
    } catch (err) {
        console.log(err);
    } finally {
        loading = false;
    }