import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Edit, Save, X, Plus, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '@/components/Navbar';
import { defaultTemplates, DefaultTemplate } from '@/data/defaultTemplates';
import { api, Template } from '@/lib/api';

const TemplatesPage = () => {
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editData, setEditData] = useState({ subject: '', body: '', signature: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', subject: '', body: '', signature: '' });

  // Default professional signature
  const defaultSignature = `--\nBest regards,\nArnav Sales Company\nEmpowering Businesses with ERP, SaaS & App Solutions`;

  // Fetch custom templates from API
  const fetchCustomTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const response = await api.getTemplates();
      setCustomTemplates(response.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load custom templates');
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Load templates on component mount
  useEffect(() => {
    fetchCustomTemplates();
  }, []);

  // Helper function to extract body and signature for editing
  const extractBodyAndSignature = (fullBody: string): { body: string; signature: string } => {
    const signatureIndex = fullBody.indexOf('\n\n--\nBest regards,');
    if (signatureIndex !== -1) {
      return {
        body: fullBody.substring(0, signatureIndex),
        signature: fullBody.substring(signatureIndex + 2)
      };
    }
    return {
      body: fullBody,
      signature: defaultSignature
    };
  };

  // Helper function to combine body and signature
  const combineBodyAndSignature = (body: string, signature: string): string => {
    return body + '\n\n' + signature;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'intro':
        return 'bg-blue-100 text-blue-800';
      case 'followup':
        return 'bg-amber-100 text-amber-800';
      case 'extro':
        return 'bg-red-100 text-red-800';
      case 'reminder':
        return 'bg-purple-100 text-purple-800';
      case 'random':
        return 'bg-green-100 text-green-800';
      case 'custom':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const startEditing = (template: DefaultTemplate | Template) => {
    setEditingTemplate(template.id);
    const { body, signature } = extractBodyAndSignature(template.body);
    setEditData({
      subject: template.subject,
      body: body,
      signature: signature
    });
  };

  const cancelEditing = () => {
    setEditingTemplate(null);
    setEditData({ subject: '', body: '', signature: '' });
  };

  const saveChanges = async (templateId: string) => {
    if (!editData.subject.trim() || !editData.body.trim()) {
      toast.error('Subject and body cannot be empty');
      return;
    }

    try {
      // Combine body and signature before saving
      const fullBody = combineBodyAndSignature(editData.body, editData.signature);
      const updates = { subject: editData.subject, body: fullBody };
      
      // Check if this is a custom template (from API)
      const isCustomTemplate = customTemplates.some(t => t.id === templateId);
      
      if (isCustomTemplate) {
        // Update custom template via API
        await api.updateTemplate(templateId, updates);
        await fetchCustomTemplates(); // Refresh custom templates
        toast.success('Custom template updated successfully ✅');
      } else {
        // Default templates are read-only, show message
        toast.error('Default templates cannot be modified. Create a custom template instead.');
        return;
      }
      
      setEditingTemplate(null);
      setEditData({ subject: '', body: '', signature: '' });
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    }
  };

  const createTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.subject.trim() || !newTemplate.body.trim()) {
      toast.error('Name, subject and body are required');
      return;
    }

    try {
      const fullBody = combineBodyAndSignature(newTemplate.body, newTemplate.signature || defaultSignature);
      const templateData = {
        name: newTemplate.name,
        subject: newTemplate.subject,
        body: fullBody,
        isActive: true
      };
      
      await api.createTemplate(templateData);
      await fetchCustomTemplates(); // Refresh custom templates
      
      // Reset form
      setNewTemplate({ name: '', subject: '', body: '', signature: '' });
      setShowCreateForm(false);
      
      toast.success('Template created successfully ✅');
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await api.deleteTemplate(templateId);
      await fetchCustomTemplates(); // Refresh custom templates
      toast.success('Template deleted successfully ✅');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <Navbar />
      
      <div className="pt-18 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Email Templates</h1>
              <p className="text-gray-600 mt-1">Manage your email templates for sequences</p>
            </div>
          </div>
        </motion.div>

        <div className="space-y-8">
          {/* Custom Templates Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
                <Mail className="w-6 h-6 text-indigo-600" />
                Custom Templates
              </h2>
              <Button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </div>

            {/* Create Template Form */}
            <AnimatePresence>
              {showCreateForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6"
                >
                  <Card className="bg-white/80 backdrop-blur-sm border-2 border-dashed border-blue-300">
                    <CardHeader>
                      <CardTitle className="text-lg text-blue-700">Create New Template</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="template-name">Template Name</Label>
                          <Input
                            id="template-name"
                            value={newTemplate.name}
                            onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter template name..."
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="template-subject">Subject Line</Label>
                          <Input
                            id="template-subject"
                            value={newTemplate.subject}
                            onChange={(e) => setNewTemplate(prev => ({ ...prev, subject: e.target.value }))}
                            placeholder="Enter email subject..."
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="template-body">Email Body</Label>
                        <Textarea
                          id="template-body"
                          value={newTemplate.body}
                          onChange={(e) => setNewTemplate(prev => ({ ...prev, body: e.target.value }))}
                          placeholder="Enter your email content...\n\nTip: You can use {{firstName}}, {{lastName}}, {{companyName}} for personalization"
                          className="rounded-xl min-h-[150px] resize-none"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="template-signature">Email Signature</Label>
                        <Textarea
                          id="template-signature"
                          value={newTemplate.signature || defaultSignature}
                          onChange={(e) => setNewTemplate(prev => ({ ...prev, signature: e.target.value }))}
                          placeholder={defaultSignature}
                          className="rounded-xl min-h-[100px] resize-none"
                        />
                        <p className="text-xs text-gray-500">
                          📝 Professional signature that will be appended to your email
                        </p>
                      </div>
                      
                      <div className="flex gap-2 justify-end">
                        <Button
                          onClick={() => {
                            setShowCreateForm(false);
                            setNewTemplate({ name: '', subject: '', body: '', signature: '' });
                          }}
                          variant="outline"
                          className="rounded-xl"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button
                          onClick={createTemplate}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Create Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom Templates List */}
            <div className="grid gap-4">
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">Loading templates...</p>
                  </div>
                </div>
              ) : customTemplates.length === 0 ? (
                <Card className="bg-white/60 backdrop-blur-sm">
                  <CardContent className="py-12 text-center">
                    <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No custom templates yet. Create your first template!</p>
                  </CardContent>
                </Card>
              ) : (
                customTemplates.map((template) => (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="bg-white/80 backdrop-blur-sm border border-gray-200 hover:shadow-lg transition-all">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                              <Mail className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-lg">{template.name}</h4>
                              <Badge className="text-xs mt-1 bg-indigo-100 text-indigo-800">
                                custom
                              </Badge>
                            </div>
                          </div>
                          
                          {editingTemplate !== template.id && (
                            <div className="flex gap-2">
                              <Button
                                onClick={() => startEditing(template)}
                                variant="outline"
                                size="sm"
                                className="rounded-xl border-blue-200 hover:border-blue-400"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </Button>
                              <Button
                                onClick={() => deleteTemplate(template.id)}
                                variant="outline"
                                size="sm"
                                className="rounded-xl border-red-200 hover:border-red-400 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          )}
                        </div>

                        {editingTemplate === template.id ? (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor={`subject-${template.id}`}>Subject Line</Label>
                              <Input
                                id={`subject-${template.id}`}
                                value={editData.subject}
                                onChange={(e) => setEditData(prev => ({ ...prev, subject: e.target.value }))}
                                className="rounded-xl"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor={`body-${template.id}`}>Email Body</Label>
                              <Textarea
                                id={`body-${template.id}`}
                                value={editData.body}
                                onChange={(e) => setEditData(prev => ({ ...prev, body: e.target.value }))}
                                className="rounded-xl min-h-[200px] resize-none"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor={`signature-${template.id}`}>Email Signature</Label>
                              <Textarea
                                id={`signature-${template.id}`}
                                value={editData.signature}
                                onChange={(e) => setEditData(prev => ({ ...prev, signature: e.target.value }))}
                                className="rounded-xl min-h-[100px] resize-none"
                              />
                            </div>
                            
                            <div className="flex gap-2 justify-end">
                              <Button
                                onClick={cancelEditing}
                                variant="outline"
                                size="sm"
                                className="rounded-xl"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </Button>
                              <Button
                                onClick={() => saveChanges(template.id)}
                                size="sm"
                                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Subject:</Label>
                              <div className="text-sm bg-gray-50 rounded-lg p-3 mt-1">
                                {template.subject}
                              </div>
                            </div>
                            
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Body:</Label>
                              <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mt-1 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
                                {template.body}
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>

          {/* Default Templates Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600" />
              Default Templates
              <Badge className="text-xs bg-blue-100 text-blue-800">Read Only</Badge>
            </h2>

            <div className="grid gap-4">
              {defaultTemplates.map((template) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="bg-white/60 backdrop-blur-sm border border-gray-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-lg">{template.name}</h4>
                            <Badge className={`text-xs mt-1 ${getTypeColor(template.type)}`}>
                              {template.type}
                            </Badge>
                          </div>
                        </div>
                        
                        <Badge className="text-xs bg-gray-100 text-gray-600">
                          Read Only
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Subject:</Label>
                          <div className="text-sm bg-gray-50 rounded-lg p-3 mt-1">
                            {template.subject}
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Body:</Label>
                          <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mt-1 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
                            {template.body}
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-sm font-medium text-gray-600">Description:</Label>
                          <p className="text-sm text-gray-600 mt-1 italic">{template.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom spacing */}
        <div className="h-16"></div>
      </div>
    </div>
  );
};

export default TemplatesPage;
