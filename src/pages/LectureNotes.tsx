import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Search, BookOpen, ChevronRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { Course, Note } from '../types';
import ReactMarkdown from 'react-markdown';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';
import { NoteBlock } from '../components/NoteBuilder';

export default function LectureNotes() {
  const { systemConfig } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isHoliday = !systemConfig || systemConfig.currentSemester === 'none';

  useEffect(() => {
    if (isHoliday) return;

    const q = query(
      collection(db, 'courses'),
      where('semester', '==', systemConfig.currentSemester)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    });

    return () => unsubscribe();
  }, [systemConfig]);

  useEffect(() => {
    if (!selectedCourse) {
      setNotes([]);
      return;
    }

    const q = query(
      collection(db, 'notes'),
      where('courseId', '==', selectedCourse.id),
      where('type', '==', 'lecture')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note)));
    });

    return () => unsubscribe();
  }, [selectedCourse]);

  const filteredCourses = courses.filter(course => 
    course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedNote) {
    let blocks: NoteBlock[] = [];
    try {
      blocks = JSON.parse(selectedNote.content);
    } catch (e) {
      // Fallback for old markdown notes
      blocks = [{ id: '1', type: 'text', content: selectedNote.content }];
    }

    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedNote(null)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Notes
        </Button>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl">{selectedNote.title}</CardTitle>
                <CardDescription>{selectedCourse?.code} - {selectedCourse?.title}</CardDescription>
              </div>
              <Badge variant="outline">{selectedNote.type.toUpperCase()}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {blocks.map((block) => (
              <div key={block.id}>
                {block.type === 'h1' && <h1 className="text-3xl font-bold mb-4">{block.content}</h1>}
                {block.type === 'h2' && <h2 className="text-2xl font-bold mb-3">{block.content}</h2>}
                {block.type === 'text' && (
                  <div className="prose dark:prose-invert max-w-none">
                    <ReactMarkdown>{block.content}</ReactMarkdown>
                  </div>
                )}
                {block.type === 'math' && (
                  <div className="py-4 overflow-x-auto flex justify-center bg-muted/30 rounded-lg">
                    <BlockMath math={block.content} />
                  </div>
                )}
                {block.type === 'diagram' && block.content && (
                  <div className="flex justify-center py-4">
                    <img 
                      src={block.content} 
                      alt="Diagram" 
                      className="max-w-full h-auto rounded-lg shadow-md"
                      referrerPolicy="no-referrer"
                      style={{
                        width: block.settings?.width || 'auto',
                        height: block.settings?.height || 'auto',
                        transform: `scale(${block.settings?.flipX ? -1 : 1}, ${block.settings?.flipY ? -1 : 1})`,
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedCourse) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedCourse(null)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Courses
        </Button>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{selectedCourse.code} Notes</h1>
          <p className="text-muted-foreground">{selectedCourse.title}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notes.length > 0 ? (
            notes.map(note => (
              <Card 
                key={note.id} 
                className="hover:bg-accent transition-colors cursor-pointer"
                onClick={() => setSelectedNote(note)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{note.title}</CardTitle>
                  <CardDescription>Added on {new Date(note.createdAt).toLocaleDateString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {(() => {
                      try {
                        const blocks = JSON.parse(note.content);
                        return blocks.find((b: any) => b.type === 'text')?.content.substring(0, 150) || 'Academic material';
                      } catch (e) {
                        return note.content.substring(0, 150);
                      }
                    })()}...
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-12 text-center border rounded-lg bg-muted/50">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium">No notes found</h3>
              <p className="text-muted-foreground">No lecture notes have been uploaded for this course yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Lecture Notes</h1>
        <p className="text-muted-foreground">Browse study materials for your current semester courses.</p>
      </div>

      {isHoliday && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Semester Ended</AlertTitle>
          <AlertDescription>
            The academic semester has ended. Access to course materials is restricted until the next semester starts.
          </AlertDescription>
        </Alert>
      )}

      {!isHoliday && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search courses by code or title..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map(course => (
              <Card 
                key={course.id} 
                className="hover:bg-accent transition-colors cursor-pointer group"
                onClick={() => setSelectedCourse(course)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-bold">{course.code}</CardTitle>
                    <CardDescription>{course.title}</CardDescription>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">{course.level} Level</Badge>
                </CardContent>
              </Card>
            ))}

            {filteredCourses.length === 0 && (
              <div className="col-span-full py-12 text-center border rounded-lg bg-muted/50">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium">No courses found</h3>
                <p className="text-muted-foreground">Try searching for a different course code or title.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
